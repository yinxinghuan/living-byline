import * as THREE from 'three'
import { IdentityTexture } from './IdentityTexture'
import {
  createProjectionMaterial,
  type ProjectionUniforms,
} from './ProjectedMaterial'

type DirectorEvents = {
  onAlignment: (score: number) => void
  onComplete: (level: number) => void
  onInteraction: () => void
  onError: (error: Error) => void
}

type ViewPose = {
  yaw: number
  pitch: number
}

type MosaicRect = {
  x0: number
  x1: number
  y0: number
  y1: number
}

const PAGE_ASPECT = 2 / 3
const CAMERA_RADIUS = 11.5
const PROJECTOR_FOV = 24
const DISPLAY_FOV = 34
const LOOK_AT = new THREE.Vector3(0, 0, 0)
const LEVEL_POSES = [
  { target: { yaw: 0.3, pitch: -0.035 }, start: { yaw: -1.42, pitch: 0.42 } },
  { target: { yaw: -0.34, pitch: 0.09 }, start: { yaw: 1.48, pitch: -0.46 } },
  { target: { yaw: 0.18, pitch: 0.16 }, start: { yaw: -1.76, pitch: -0.38 } },
] as const

export class SceneDirector {
  private readonly container: HTMLElement
  private readonly events: DirectorEvents
  private readonly identityTexture: IdentityTexture
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(DISPLAY_FOV, 1, 0.1, 80)
  private readonly projector = new THREE.PerspectiveCamera(PROJECTOR_FOV, PAGE_ASPECT, 0.1, 40)
  private readonly clock = new THREE.Clock()
  private readonly projectedMaterial: THREE.ShaderMaterial
  private readonly projectionUniforms: ProjectionUniforms
  private readonly root = new THREE.Group()
  private readonly sceneObjects: THREE.Object3D[] = []
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private level = 0
  private desiredView: ViewPose = { ...LEVEL_POSES[0].start }
  private currentView: ViewPose = { ...LEVEL_POSES[0].start }
  private pointerId: number | null = null
  private lastPointer = new THREE.Vector2()
  private dragging = false
  private alignment = 0
  private lastReportedAlignment = -1
  private lockStartedAt = 0
  private completed = false
  private ghostPreview = false
  private running = true
  private inViewport = true
  private frame = 0
  private transition = 1
  private transitionTarget = 1
  private resizeObserver: ResizeObserver
  private intersectionObserver: IntersectionObserver

  constructor(
    container: HTMLElement,
    identity: { name: string; platform: string; avatarDataUrl: string },
    events: DirectorEvents,
  ) {
    this.container = container
    this.events = events
    this.identityTexture = new IdentityTexture(identity)
    const projection = createProjectionMaterial(this.identityTexture.texture)
    this.projectedMaterial = projection.material
    this.projectionUniforms = projection.uniforms

    this.renderer = new THREE.WebGLRenderer({
      antialias: innerWidth >= 360,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 350 ? 1.25 : 1.65))
    this.renderer.domElement.className = 'lb-stage__canvas'
    this.renderer.domElement.tabIndex = 0
    this.renderer.domElement.setAttribute('aria-label', 'Rotate the 3D projection sculpture')
    this.container.append(this.renderer.domElement)

    this.scene.background = new THREE.Color('#07090d')
    this.scene.fog = new THREE.FogExp2('#07090d', 0.038)
    this.scene.add(this.root)
    this.setupLights()
    this.bindInput()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.inViewport = !!entry?.isIntersecting && (entry?.intersectionRatio ?? 0) >= 0.08
        this.syncLoop()
      },
      { threshold: [0, 0.08, 0.25] },
    )
    this.intersectionObserver.observe(this.container)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  async init() {
    try {
      await this.identityTexture.render(0)
      this.buildLevel(0)
      this.applyProjectorPose()
      this.resize()
      this.renderFrame()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      this.syncLoop()
    } catch (error) {
      this.events.onError(error instanceof Error ? error : new Error('Scene initialization failed'))
    }
  }

  async goToLevel(level: number) {
    this.transitionTarget = 0
    await delay(this.reducedMotion ? 80 : 360)
    this.level = THREE.MathUtils.clamp(level, 0, 2)
    this.completed = false
    this.lockStartedAt = 0
    this.alignment = 0
    this.lastReportedAlignment = -1
    this.desiredView = { ...LEVEL_POSES[this.level].start }
    this.currentView = { ...LEVEL_POSES[this.level].start }
    await this.identityTexture.render(this.level)
    this.buildLevel(this.level)
    this.applyProjectorPose()
    this.transition = 0
    this.transitionTarget = 1
  }

  restart() {
    return this.goToLevel(0)
  }

  setGhostPreview(active: boolean) {
    this.ghostPreview = active
  }

  nudgeView(yawDelta: number, pitchDelta: number) {
    if (this.completed) return
    this.events.onInteraction()
    this.desiredView.yaw += yawDelta
    this.desiredView.pitch = THREE.MathUtils.clamp(this.desiredView.pitch + pitchDelta, -1.42, 1.42)
  }

  getDebugState() {
    const target = LEVEL_POSES[this.level].target
    const depths: number[] = []
    const mosaicDepths: number[] = []
    const mosaicAreas: number[] = []
    const kinds = new Set<string>()
    let transformChecksum = 0
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const world = new THREE.Vector3()
        object.getWorldPosition(world)
        depths.push(world.z)
        kinds.add(object.geometry.type)
        if (object.userData.mosaicArea) {
          mosaicAreas.push(object.userData.mosaicArea as number)
          mosaicDepths.push(object.userData.mosaicDepth as number)
        }
      }
    })
    this.sceneObjects.forEach((object, index) => {
      transformChecksum += (index + 1) * (
        object.position.x * 3.1 +
        object.position.y * 5.3 +
        object.position.z * 7.7 +
        object.rotation.x * 11.1 +
        object.rotation.y * 13.7 +
        object.rotation.z * 17.3
      )
    })
    return {
      yaw: this.currentView.yaw,
      pitch: this.currentView.pitch,
      targetYaw: target.yaw,
      targetPitch: target.pitch,
      angularError: this.angularError(),
      alignment: this.alignment,
      depthSpread: depths.length ? Math.max(...depths) - Math.min(...depths) : 0,
      mosaicAreaRatio: mosaicAreas.length
        ? Math.max(...mosaicAreas) / Math.min(...mosaicAreas)
        : 0,
      mosaicNearShare: mosaicDepths.length
        ? mosaicDepths.filter((depth) => Math.abs(depth) < 0.5).length / mosaicDepths.length
        : 0,
      mosaicDepthSpread: mosaicDepths.length
        ? Math.max(...mosaicDepths) - Math.min(...mosaicDepths)
        : 0,
      mosaicPieceCount: mosaicAreas.length,
      geometryKinds: [...kinds],
      objectCount: this.sceneObjects.length,
      transformChecksum: Number(transformChecksum.toFixed(6)),
      projectorAspect: this.projector.aspect,
      textureAspect: this.identityTexture.canvas.width / this.identityTexture.canvas.height,
    }
  }

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight('#d9e4ff', '#130d18', 1.8))
    const key = new THREE.DirectionalLight('#fff8e8', 3.6)
    key.position.set(-5, 7, 8)
    this.scene.add(key)
    const coral = new THREE.PointLight('#ff5b4d', 22, 18, 1.7)
    coral.position.set(4, 0.5, 4)
    this.scene.add(coral)
    const blue = new THREE.PointLight('#4d7cff', 18, 16, 1.8)
    blue.position.set(-4, 1.5, 1)
    this.scene.add(blue)
  }

  private bindInput() {
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.completed || this.pointerId !== null) return
    this.events.onInteraction()
    this.pointerId = event.pointerId
    this.dragging = true
    this.lastPointer.set(event.clientX, event.clientY)
    this.renderer.domElement.setPointerCapture(event.pointerId)
    this.renderer.domElement.classList.add('is-dragging')
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId || this.completed) return
    const deltaX = event.clientX - this.lastPointer.x
    const deltaY = event.clientY - this.lastPointer.y
    this.lastPointer.set(event.clientX, event.clientY)
    this.desiredView.yaw -= deltaX * 0.006
    this.desiredView.pitch = THREE.MathUtils.clamp(
      this.desiredView.pitch + deltaY * 0.0048,
      -1.42,
      1.42,
    )
  }

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId)
    }
    this.pointerId = null
    this.dragging = false
    this.renderer.domElement.classList.remove('is-dragging')
  }

  private applyProjectorPose() {
    setOrbitPosition(this.projector, LEVEL_POSES[this.level].target, CAMERA_RADIUS)
    this.projector.lookAt(LOOK_AT)
    this.projector.updateMatrixWorld()
    this.projector.updateProjectionMatrix()
    this.projectionUniforms.projectorProjection.value.copy(this.projector.projectionMatrix)
    this.projectionUniforms.projectionView.value.copy(this.projector.matrixWorldInverse)
    this.projectionUniforms.projectorPosition.value.copy(this.projector.position)
  }

  private buildLevel(level: number) {
    this.clearRoot()
    const target = LEVEL_POSES[level].target
    this.root.rotation.set(-target.pitch, target.yaw, 0)
    this.projectionUniforms.accent.value.set(level === 1 ? '#4d7cff' : '#ff5b4d')
    if (level === 0) this.buildArchGarden()
    if (level === 1) this.buildFoldTheatre()
    if (level === 2) this.buildOrbitSculpture()
    this.buildGround(level)
  }

  private buildArchGarden() {
    this.buildDepthMosaic(0)
    this.addProjected(new THREE.TorusGeometry(1.72, 0.22, 20, 96, Math.PI), [0, 0.55, 1.35], [0.04, 0.05, 0])
    this.addProjected(new THREE.TorusGeometry(1.32, 0.15, 18, 80, Math.PI), [0, 0.25, -1.28], [-0.08, -0.12, 0])
    this.addProjected(new THREE.SphereGeometry(0.62, 30, 22), [-0.92, -1.28, 2.05], [0, 0, 0])
    this.addProjected(new THREE.SphereGeometry(0.46, 26, 20), [1.08, 1.18, -1.38], [0, 0, 0])
    this.addProjected(new THREE.SphereGeometry(0.32, 22, 18), [0.42, -1.92, 1.12], [0, 0, 0])
    this.addProjected(new THREE.CylinderGeometry(0.18, 0.42, 3.8, 24), [-1.42, -0.1, -0.86], [0.06, 0, -0.04])
    this.addProjected(new THREE.CylinderGeometry(0.38, 0.16, 3.45, 24), [1.38, 0.08, 0.78], [-0.05, 0, 0.06])
  }

  private buildFoldTheatre() {
    this.buildDepthMosaic(1)
    this.addProjected(new THREE.TorusGeometry(1.76, 0.2, 18, 96), [0, 0.12, 1.52], [0.42, 0.18, 0.82])
    this.addProjected(new THREE.TorusGeometry(1.28, 0.13, 16, 80), [0, -0.18, -1.42], [1.08, -0.22, 0.28])
    this.addProjected(new THREE.ConeGeometry(0.54, 1.74, 28), [-1.18, -1.42, 1.9], [0.12, 0.08, -0.18])
    this.addProjected(new THREE.ConeGeometry(0.42, 1.5, 24), [1.3, -1.58, -1.18], [-0.12, 0.06, 0.2])
    this.addProjected(new THREE.SphereGeometry(0.48, 28, 20), [-1.1, 1.42, -1.58], [0, 0, 0])
    this.addProjected(new THREE.SphereGeometry(0.58, 30, 22), [1.05, 1.18, 1.82], [0, 0, 0])
    this.addProjected(new THREE.OctahedronGeometry(0.5, 1), [0.15, -0.85, 2.18], [0.3, 0.2, 0.1])
  }

  private buildOrbitSculpture() {
    this.buildDepthMosaic(2)
    this.addProjected(new THREE.TorusGeometry(1.72, 0.19, 20, 112), [0, 0.06, 1.86], [0.82, 0.12, 0.24])
    this.addProjected(new THREE.TorusGeometry(1.34, 0.13, 18, 96), [0, -0.1, -1.52], [0.24, 0.72, 0.92])
    this.addProjected(new THREE.TorusGeometry(0.92, 0.1, 16, 80), [0.08, 0.18, 2.25], [1.12, -0.28, 0.52])
    this.addProjected(new THREE.CylinderGeometry(0.24, 0.24, 4.15, 24), [0, 0, -1.82], [0.06, 0.08, 0.32])
    this.addProjected(new THREE.SphereGeometry(0.52, 28, 20), [-1.02, 1.26, 1.52], [0, 0, 0])
    this.addProjected(new THREE.SphereGeometry(0.4, 24, 18), [1.16, -1.28, -1.68], [0, 0, 0])
    this.addProjected(new THREE.IcosahedronGeometry(0.48, 1), [0.98, 1.36, 2.1], [0.2, 0.4, 0.1])
  }

  private buildDepthMosaic(level: number) {
    const width = 3.3
    const height = 4.95
    const random = seededRandom(7429 + level * 3181)
    const regions = splitMosaicRect(
      { x0: -width / 2, x1: width / 2, y0: -height / 2, y1: height / 2 },
      random,
      level,
    )
    const pieces: Array<Array<[number, number]>> = []
    regions.forEach((region, index) => {
      const rectangle: Array<[number, number]> = [
        [region.x0, region.y0],
        [region.x1, region.y0],
        [region.x1, region.y1],
        [region.x0, region.y1],
      ]
      const area = (region.x1 - region.x0) * (region.y1 - region.y0)
      if (area > 0.2 && random() < 0.48) {
        const diagonal = (index + level) % 2 === 0
        pieces.push(
          diagonal
            ? [rectangle[0], rectangle[1], rectangle[2]]
            : [rectangle[0], rectangle[1], rectangle[3]],
          diagonal
            ? [rectangle[0], rectangle[2], rectangle[3]]
            : [rectangle[1], rectangle[2], rectangle[3]],
        )
      } else {
        pieces.push(rectangle)
      }
    })

    const byArea = pieces
      .map((points, index) => ({ index, area: polygonArea(points) }))
      .sort((a, b) => b.area - a.area)
    const foregroundAnchor = byArea[0]?.index ?? 0
    const backgroundAnchor = byArea[1]?.index ?? 1
    const tinyAccent = byArea.at(-1)?.index ?? pieces.length - 1

    pieces.forEach((points, index) => {
      const noise = hash01(index * 13.17 + level * 71.9)
      let z: number
      if (index === foregroundAnchor) {
        z = level === 1 ? -2.85 : 2.95
      } else if (index === backgroundAnchor) {
        z = level === 1 ? 2.72 : -2.68
      } else if (index === tinyAccent) {
        z = level === 2 ? -3.05 : 2.48
      } else if (noise < 0.58) {
        z = (noise / 0.58 - 0.5) * 0.82
      } else if (noise < 0.78) {
        z = 0.72 + ((noise - 0.58) / 0.2) * 0.82
      } else if (noise < 0.94) {
        z = -0.78 - ((noise - 0.78) / 0.16) * 0.9
      } else {
        z = (index % 2 ? 1 : -1) * (2.05 + ((noise - 0.94) / 0.06) * 0.55)
      }
      this.addDepthPiece(points, z, 0.09 + Math.abs(z) * 0.105)
    })
  }

  private addDepthPiece(
    points: Array<[number, number]>,
    z: number,
    thickness: number,
  ) {
    const scale = (CAMERA_RADIUS - z) / CAMERA_RADIUS
    const centroid = points.reduce(
      (sum, [x, y]) => [sum[0] + x / points.length, sum[1] + y / points.length],
      [0, 0],
    )
    const inflated = points.map(([x, y]) => [
      (centroid[0] + (x - centroid[0]) * 1.035) * scale,
      (centroid[1] + (y - centroid[1]) * 1.035) * scale,
    ] as [number, number])
    const shape = new THREE.Shape()
    shape.moveTo(inflated[0][0], inflated[0][1])
    inflated.slice(1).forEach(([x, y]) => shape.lineTo(x, y))
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 1,
    })
    const mesh = this.addProjected(geometry, [0, 0, z - thickness], [0, 0, 0])
    mesh.userData.mosaicArea = polygonArea(points)
    mesh.userData.mosaicDepth = z
  }

  private addProjected(
    geometry: THREE.BufferGeometry,
    position: [number, number, number],
    rotation: [number, number, number],
  ) {
    const mesh = new THREE.Mesh(geometry, this.projectedMaterial)
    mesh.position.set(...position)
    mesh.rotation.set(...rotation)
    this.root.add(mesh)
    this.sceneObjects.push(mesh)
    return mesh
  }

  private buildGround(level: number) {
    const grid = new THREE.GridHelper(
      22,
      level === 2 ? 28 : 22,
      level === 1 ? '#4d7cff' : '#ff5b4d',
      '#151b24',
    )
    grid.position.y = -2.62
    grid.position.z = -1.8
    grid.material.transparent = true
    grid.material.opacity = 0.2
    this.root.add(grid)
    this.sceneObjects.push(grid)
  }

  private clearRoot() {
    for (const child of [...this.root.children]) {
      child.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            if (material !== this.projectedMaterial) material.dispose()
          })
        }
      })
      this.root.remove(child)
    }
    this.sceneObjects.length = 0
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.projector.aspect = PAGE_ASPECT
    this.applyProjectorPose()
  }

  private angularError() {
    const target = LEVEL_POSES[this.level].target
    return Math.hypot(
      shortestAngle(this.currentView.yaw - target.yaw),
      this.currentView.pitch - target.pitch,
    )
  }

  private onVisibility = () => {
    this.running = !document.hidden
    this.syncLoop()
  }

  private syncLoop() {
    if (this.running && this.inViewport && !this.frame) {
      this.clock.start()
      this.frame = requestAnimationFrame(this.tick)
    }
    if ((!this.running || !this.inViewport) && this.frame) {
      cancelAnimationFrame(this.frame)
      this.frame = 0
      this.clock.stop()
    }
  }

  private tick = () => {
    this.frame = 0
    const elapsed = this.clock.getElapsedTime()
    this.transition = THREE.MathUtils.lerp(
      this.transition,
      this.transitionTarget,
      this.reducedMotion ? 1 : 0.075,
    )

    const target = LEVEL_POSES[this.level].target
    const damping = this.dragging ? 0.24 : 0.14
    this.currentView.yaw = THREE.MathUtils.lerp(this.currentView.yaw, this.desiredView.yaw, damping)
    this.currentView.pitch = THREE.MathUtils.lerp(this.currentView.pitch, this.desiredView.pitch, damping)

    const ghostYaw = this.ghostPreview ? Math.sin(elapsed * 2.1) * 0.13 : 0
    const displayPose = {
      yaw: this.currentView.yaw + ghostYaw,
      pitch: this.currentView.pitch + (this.ghostPreview ? Math.cos(elapsed * 1.7) * 0.025 : 0),
    }
    setOrbitPosition(this.camera, displayPose, CAMERA_RADIUS)
    this.camera.lookAt(LOOK_AT)

    const error = this.angularError()
    this.alignment = THREE.MathUtils.smoothstep(1 - THREE.MathUtils.clamp(error / 0.74, 0, 1), 0, 1)
    if (Math.abs(this.alignment - this.lastReportedAlignment) > 0.006) {
      this.lastReportedAlignment = this.alignment
      this.events.onAlignment(this.alignment)
    }

    if (!this.ghostPreview && !this.completed && error < 0.032) {
      if (!this.lockStartedAt) this.lockStartedAt = performance.now()
      if (performance.now() - this.lockStartedAt > 380) {
        this.completed = true
        this.desiredView = { ...target }
        this.currentView = { ...target }
        this.events.onAlignment(1)
        this.events.onComplete(this.level)
      }
    } else {
      this.lockStartedAt = 0
    }

    this.projectionUniforms.reveal.value = 1
    this.projectionUniforms.resolve.value = this.alignment
    this.projectionUniforms.boost.value = this.completed
      ? 0
      : this.alignment > 0.82
        ? (this.alignment - 0.82) * 1.2
        : 0
    this.projectionUniforms.time.value = elapsed
    this.root.scale.setScalar(0.94 + this.transition * 0.06)
    this.root.rotation.z = (1 - this.transition) * 0.06
    this.renderFrame()
    this.syncLoop()
  }

  private renderFrame() {
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.intersectionObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerUp)
    this.clearRoot()
    this.identityTexture.dispose()
    this.projectedMaterial.dispose()
    this.renderer.dispose()
  }
}

function setOrbitPosition(camera: THREE.Camera, pose: ViewPose, radius: number) {
  const cosPitch = Math.cos(pose.pitch)
  camera.position.set(
    Math.sin(pose.yaw) * cosPitch * radius,
    Math.sin(pose.pitch) * radius,
    Math.cos(pose.yaw) * cosPitch * radius,
  )
}

function splitMosaicRect(
  root: MosaicRect,
  random: () => number,
  level: number,
) {
  const regions: MosaicRect[] = []
  const visit = (rect: MosaicRect, depth: number) => {
    const width = rect.x1 - rect.x0
    const height = rect.y1 - rect.y0
    const stopChance = depth < 2 ? 0 : depth === 2 ? 0.18 : depth === 3 ? 0.44 : 0.72
    if (depth >= 5 || (depth >= 2 && random() < stopChance)) {
      regions.push(rect)
      return
    }
    const splitVertical = width / height > 1.35
      ? true
      : height / width > 1.7
        ? false
        : random() > 0.48
    const edgeBias = random()
    const ratio = depth === 0
      ? [0.27, 0.64, 0.38][level]
      : edgeBias < 0.5
        ? 0.16 + random() * 0.22
        : 0.48 + random() * 0.34
    if (splitVertical) {
      const cut = rect.x0 + width * ratio
      visit({ ...rect, x1: cut }, depth + 1)
      visit({ ...rect, x0: cut }, depth + 1)
    } else {
      const cut = rect.y0 + height * ratio
      visit({ ...rect, y1: cut }, depth + 1)
      visit({ ...rect, y0: cut }, depth + 1)
    }
  }
  visit(root, 0)
  return regions
}

function polygonArea(points: Array<[number, number]>) {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[(index + 1) % points.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) * 0.5
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function hash01(value: number) {
  return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1
}

function shortestAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}
