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

const PAGE_ASPECT = 2 / 3
const CAMERA_RADIUS = 11.5
const PROJECTOR_FOV = 24
const DISPLAY_FOV = 34
const LOOK_AT = new THREE.Vector3(0, -0.08, 0)
const LEVEL_POSES = [
  { target: { yaw: 0.3, pitch: -0.035 }, start: { yaw: -0.42, pitch: 0.13 } },
  { target: { yaw: -0.34, pitch: 0.09 }, start: { yaw: 0.38, pitch: -0.12 } },
  { target: { yaw: 0.18, pitch: 0.16 }, start: { yaw: -0.5, pitch: -0.09 } },
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
    identity: { name: string; platform: string },
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
    this.desiredView.yaw = THREE.MathUtils.clamp(
      this.desiredView.yaw + yawDelta,
      LEVEL_POSES[this.level].target.yaw - 1.15,
      LEVEL_POSES[this.level].target.yaw + 1.15,
    )
    this.desiredView.pitch = THREE.MathUtils.clamp(this.desiredView.pitch + pitchDelta, -0.58, 0.58)
  }

  getDebugState() {
    const target = LEVEL_POSES[this.level].target
    const depths: number[] = []
    const kinds = new Set<string>()
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const world = new THREE.Vector3()
        object.getWorldPosition(world)
        depths.push(world.z)
        kinds.add(object.geometry.type)
      }
    })
    return {
      yaw: this.currentView.yaw,
      pitch: this.currentView.pitch,
      targetYaw: target.yaw,
      targetPitch: target.pitch,
      angularError: this.angularError(),
      alignment: this.alignment,
      depthSpread: depths.length ? Math.max(...depths) - Math.min(...depths) : 0,
      geometryKinds: [...kinds],
      objectCount: this.sceneObjects.length,
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
    this.desiredView.yaw = THREE.MathUtils.clamp(
      this.desiredView.yaw - deltaX * 0.006,
      LEVEL_POSES[this.level].target.yaw - 1.15,
      LEVEL_POSES[this.level].target.yaw + 1.15,
    )
    this.desiredView.pitch = THREE.MathUtils.clamp(
      this.desiredView.pitch + deltaY * 0.0048,
      -0.58,
      0.58,
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
    const columns = [
      [-1.45, 0.05, 0.8, -0.1],
      [-0.98, -0.1, -0.25, 0.12],
      [-0.5, 0.08, 0.55, -0.08],
      [0, -0.08, -0.5, 0.08],
      [0.5, 0.1, 0.35, -0.1],
      [0.98, -0.06, -0.35, 0.12],
      [1.45, 0.04, 0.72, -0.08],
    ] as const
    columns.forEach(([x, y, z, angle], index) => {
      this.addProjected(
        new THREE.BoxGeometry(index % 2 ? 0.58 : 0.54, 4.65, index % 2 ? 0.34 : 0.48),
        [x, y, z],
        [0.02 * (index % 3 - 1), angle, angle * 0.22],
      )
    })
    this.addProjected(new THREE.TorusGeometry(1.65, 0.21, 18, 96, Math.PI), [0, 0.72, 0.1], [0, 0, 0])
    this.addProjected(new THREE.TorusGeometry(1.28, 0.15, 16, 80, Math.PI), [0, 0.48, 0.92], [0.06, -0.12, 0])
    this.addProjected(new THREE.SphereGeometry(0.58, 28, 20), [-0.82, -1.24, 1.25], [0, 0, 0])
    this.addProjected(new THREE.SphereGeometry(0.42, 24, 18), [0.95, 1.24, 0.92], [0, 0, 0])
    this.addProjected(new THREE.SphereGeometry(0.3, 20, 16), [0.12, -1.86, 1.45], [0, 0, 0])
    this.addSolidArch(2.12, 0.055, -0.95, '#ff5b4d', [0.04, 0.08, 0])
    this.addSolidArch(2.38, 0.035, -1.28, '#4d7cff', [-0.05, -0.1, 0])
    this.addPedestal([-1.6, -2.25, 0.2], 0.5)
    this.addPedestal([1.45, -2.25, -0.35], 0.62)
  }

  private buildFoldTheatre() {
    const stripWidth = 3.25 / 9
    for (let index = 0; index < 9; index += 1) {
      const x = -1.62 + stripWidth / 2 + index * stripWidth
      const fold = index % 2 === 0 ? -1 : 1
      const z = 0.16 + Math.abs(index - 4) * 0.18
      this.addProjected(
        new THREE.BoxGeometry(stripWidth + 0.035, 4.55, 0.16),
        [x, Math.sin(index * 1.3) * 0.08, z],
        [fold * 0.025, fold * 0.5, fold * 0.018],
      )
    }
    this.addProjected(new THREE.TorusGeometry(1.88, 0.18, 18, 96, Math.PI), [0, 0.92, -0.02], [0.1, 0.2, 0])
    this.addProjected(new THREE.CylinderGeometry(0.34, 0.5, 1.65, 24), [-1.36, -1.48, 1.15], [0.08, 0, -0.16])
    this.addProjected(new THREE.CylinderGeometry(0.48, 0.28, 1.35, 24), [1.33, -1.62, 0.85], [-0.08, 0, 0.18])
    this.addProjected(new THREE.SphereGeometry(0.38, 24, 18), [-1.18, 1.48, 1.24], [0, 0, 0])
    this.addProjected(new THREE.SphereGeometry(0.52, 28, 20), [1.22, 1.18, 1.32], [0, 0, 0])
    this.addSolidArch(2.22, 0.06, -0.92, '#4d7cff', [0.48, 0.24, 1.02])
    this.addSolidArch(2.48, 0.04, -1.32, '#ff5b4d', [1.16, -0.14, 0.3])
  }

  private buildOrbitSculpture() {
    const columns = 4
    const rows = 5
    const tileWidth = 3.3 / columns
    const tileHeight = 4.6 / rows
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column
        const angle = index / (columns * rows) * Math.PI * 2
        const x = -1.65 + tileWidth / 2 + column * tileWidth
        const y = 2.3 - tileHeight / 2 - row * tileHeight
        const z = 0.2 + Math.sin(angle * 2) * 0.72
        this.addProjected(
          index % 5 === 0
            ? new THREE.SphereGeometry(Math.min(tileWidth, tileHeight) * 0.55, 22, 16)
            : new THREE.BoxGeometry(tileWidth + 0.045, tileHeight + 0.045, 0.18 + (index % 3) * 0.06),
          [x + Math.cos(angle) * 0.06, y + Math.sin(angle) * 0.05, z],
          [Math.sin(angle) * 0.12, Math.cos(angle) * 0.3, Math.sin(angle * 1.5) * 0.09],
        )
      }
    }
    this.addProjected(new THREE.TorusGeometry(1.68, 0.2, 18, 112), [0, 0.05, 0.88], [0.86, 0.1, 0.28])
    this.addProjected(new THREE.TorusGeometry(1.28, 0.12, 16, 96), [0, -0.1, 1.34], [0.28, 0.7, 0.92])
    this.addProjected(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 24), [0, 0, -0.5], [0.05, 0.1, 0.34])
    this.addSolidArch(2.35, 0.045, -1.05, '#ff5b4d', [0.92, 0.18, 0.2])
    this.addSolidArch(2.65, 0.035, -1.4, '#4d7cff', [0.22, 0.48, 1.12])
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
  }

  private addSolidArch(
    radius: number,
    tube: number,
    z: number,
    color: THREE.ColorRepresentation,
    rotation: [number, number, number],
  ) {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.28,
      roughness: 0.42,
      metalness: 0.18,
    })
    const arch = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 96), material)
    arch.position.z = z
    arch.rotation.set(...rotation)
    this.root.add(arch)
    this.sceneObjects.push(arch)
  }

  private addPedestal(position: [number, number, number], radius: number) {
    const material = new THREE.MeshStandardMaterial({
      color: '#252d39',
      roughness: 0.7,
      metalness: 0.08,
    })
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.12, 0.34, 24), material)
    pedestal.position.set(...position)
    this.root.add(pedestal)
    this.sceneObjects.push(pedestal)
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
    return Math.hypot(this.currentView.yaw - target.yaw, this.currentView.pitch - target.pitch)
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
    const desiredError = Math.hypot(
      this.desiredView.yaw - target.yaw,
      this.desiredView.pitch - target.pitch,
    )
    if (!this.dragging && desiredError < 0.13 && !this.completed) {
      const magnet = this.reducedMotion ? 0.24 : 0.065
      this.desiredView.yaw = THREE.MathUtils.lerp(this.desiredView.yaw, target.yaw, magnet)
      this.desiredView.pitch = THREE.MathUtils.lerp(this.desiredView.pitch, target.pitch, magnet)
    }
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

    this.projectionUniforms.reveal.value = 0.96
    this.projectionUniforms.boost.value = this.alignment > 0.82 ? (this.alignment - 0.82) * 1.7 : 0
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

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}
