import * as THREE from 'three'
import { IdentityTexture } from './IdentityTexture'
import {
  createProjectionMaterial,
  type ProjectionUniforms,
} from './ProjectedMaterial'

type DirectorEvents = {
  onError: (error: Error) => void
}

type PieceState = {
  targetPosition: THREE.Vector3
  targetRotation: THREE.Euler
  scatterPosition: THREE.Vector3
  scatterRotation: THREE.Euler
}

export class SceneDirector {
  private readonly container: HTMLElement
  private readonly events: DirectorEvents
  private readonly identityTexture: IdentityTexture
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
  private readonly projector = new THREE.PerspectiveCamera(39, 1, 0.1, 40)
  private readonly clock = new THREE.Clock()
  private readonly projectedMaterial: THREE.ShaderMaterial
  private readonly projectionUniforms: ProjectionUniforms
  private readonly root = new THREE.Group()
  private readonly pieces: THREE.Object3D[] = []
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private progress = 0
  private alignment = 0
  private targetYaw = 0
  private yaw = 0
  private targetPitch = -0.05
  private pitch = -0.05
  private ghostPreview = false
  private running = true
  private inViewport = true
  private frame = 0
  private pointerId: number | null = null
  private pointerStart = new THREE.Vector2()
  private pointerPrevious = new THREE.Vector2()
  private transition = 1
  private transitionTarget = 1
  private viewMode = false
  private impact = 0
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 350 ? 1.3 : 1.7))
    this.renderer.domElement.className = 'lb-stage__canvas'
    this.renderer.domElement.setAttribute('aria-label', 'Interactive typographic projection chamber')
    this.container.append(this.renderer.domElement)

    this.scene.background = new THREE.Color('#07090d')
    this.scene.fog = new THREE.FogExp2('#07090d', 0.048)
    this.scene.add(this.root)
    this.setupLights()
    this.setupCamera()
    this.setupEvents()

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
    await delay(this.reducedMotion ? 80 : 430)
    this.progress = 0
    this.alignment = 0
    this.viewMode = false
    this.impact = 0
    this.targetYaw = this.yaw = 0
    this.targetPitch = this.pitch = -0.05
    await this.identityTexture.render(level)
    this.buildLevel(level)
    this.transition = 0
    this.transitionTarget = 1
  }

  restart() {
    return this.goToLevel(0)
  }

  setGhostPreview(active: boolean) {
    this.ghostPreview = active
  }

  setAssemblyProgress(value: number) {
    this.progress = THREE.MathUtils.clamp(value, 0, 1)
    this.impact = 1
  }

  setViewMode(active: boolean) {
    this.viewMode = active
  }

  rotateByKeyboard(x: number, y: number) {
    this.targetYaw = THREE.MathUtils.clamp(this.targetYaw + x, -0.62, 0.62)
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + y, -0.28, 0.24)
  }

  private setupLights() {
    const ambient = new THREE.HemisphereLight('#d9e4ff', '#15101a', 1.7)
    this.scene.add(ambient)
    const key = new THREE.DirectionalLight('#f3f0e8', 3.4)
    key.position.set(-5, 7, 8)
    this.scene.add(key)
    const rim = new THREE.PointLight('#ff5b4d', 18, 18, 1.8)
    rim.position.set(4, 1, 4)
    this.scene.add(rim)
  }

  private setupCamera() {
    this.camera.position.set(0, 0.1, 10.2)
    this.projector.position.set(0, 0.2, 11.5)
    this.projector.lookAt(0, 0, 0)
    this.projector.updateMatrixWorld()
  }

  private setupEvents() {
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.viewMode) return
    if (this.pointerId !== null) return
    this.pointerId = event.pointerId
    this.pointerStart.set(event.clientX, event.clientY)
    this.pointerPrevious.copy(this.pointerStart)
    this.renderer.domElement.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return
    const current = new THREE.Vector2(event.clientX, event.clientY)
    const distance = current.distanceTo(this.pointerStart)
    if (distance > 8) {
      const delta = current.clone().sub(this.pointerPrevious)
      this.targetYaw = THREE.MathUtils.clamp(this.targetYaw - delta.x * 0.006, -0.62, 0.62)
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - delta.y * 0.004, -0.28, 0.24)
    }
    this.pointerPrevious.copy(current)
  }

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return
    this.pointerId = null
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId)
    }
  }

  private buildLevel(level: number) {
    this.clearRoot()
    this.projectionUniforms.accent.value.set(level === 1 ? '#4d7cff' : '#ff5b4d')
    if (level === 0) this.buildThreshold()
    if (level === 1) this.buildFoldTheatre()
    if (level === 2) this.buildOrbitPress()
    this.buildGround(level)
  }

  private buildThreshold() {
    for (let index = 0; index < 5; index += 1) {
      const offset = index - 2
      this.addPiece(
        new THREE.BoxGeometry(0.68, 4.75 - Math.abs(offset) * 0.12, 0.13),
        [offset * 0.64, -0.05, 0.22 - Math.abs(offset) * 0.08],
        [0, offset * -0.035, 0],
        index,
      )
    }
    this.addPiece(new THREE.BoxGeometry(3.4, 0.16, 0.18), [0, 2.43, 0], [0, 0, 0], 6)
    this.addPiece(new THREE.BoxGeometry(3.4, 0.12, 0.18), [0, -2.47, 0], [0, 0, 0], 7)
  }

  private buildFoldTheatre() {
    for (let index = 0; index < 7; index += 1) {
      const offset = index - 3
      const fold = index % 2 === 0 ? -1 : 1
      this.addPiece(
        new THREE.BoxGeometry(0.52, 4.8, 0.1),
        [offset * 0.49, -0.04, 0.2 - Math.abs(offset) * 0.055],
        [0, fold * 0.16, 0],
        index,
      )
    }
    this.addPiece(new THREE.BoxGeometry(3.55, 0.16, 0.2), [0, -2.5, -0.02], [0, 0, 0], 8)
  }

  private buildOrbitPress() {
    this.addPiece(new THREE.BoxGeometry(3.15, 4.65, 0.12), [0, -0.02, 0.35], [0, 0, 0], 0)
    this.addPiece(new THREE.TorusGeometry(1.72, 0.075, 16, 96), [0, 0.05, -0.5], [0.88, 0.16, 0.18], 1)
    this.addPiece(new THREE.TorusGeometry(2.02, 0.055, 14, 96), [0, 0.05, -0.62], [0.28, 0.38, 1.08], 2)
    this.addPiece(new THREE.SphereGeometry(0.34, 32, 24), [1.2, 1.42, 0.74], [0, 0, 0], 3)
  }

  private addPiece(
    geometry: THREE.BufferGeometry,
    position: [number, number, number],
    rotation: [number, number, number],
    seed: number,
  ) {
    const mesh = new THREE.Mesh(geometry, this.projectedMaterial)
    const targetPosition = new THREE.Vector3(...position)
    const targetRotation = new THREE.Euler(...rotation)
    const scatterPosition = targetPosition
      .clone()
      .add(
        new THREE.Vector3(
          Math.sin(seed * 4.7 + 0.4) * 0.28,
          Math.cos(seed * 2.9 + 0.8) * 0.22,
          Math.sin(seed * 3.2) * 0.34,
        ),
      )
    const scatterRotation = new THREE.Euler(
      rotation[0] + Math.sin(seed * 2.3) * 0.12,
      rotation[1] + Math.cos(seed * 1.7) * 0.16,
      rotation[2] + Math.sin(seed * 4.1) * 0.08,
    )
    mesh.userData.piece = {
      targetPosition,
      targetRotation,
      scatterPosition,
      scatterRotation,
    } satisfies PieceState
    mesh.position.copy(scatterPosition)
    mesh.rotation.copy(scatterRotation)
    this.root.add(mesh)
    this.pieces.push(mesh)
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
    grid.material.opacity = 0.22
    this.root.add(grid)
  }

  private clearRoot() {
    for (const child of [...this.root.children]) {
      child.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            if (material !== this.projectedMaterial) material.dispose()
          })
        }
      })
      this.root.remove(child)
    }
    this.pieces.length = 0
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.projector.aspect = width / height
    this.projector.updateProjectionMatrix()
    this.projector.updateMatrixWorld()
    this.projectionUniforms.projectorProjection.value.copy(this.projector.projectionMatrix)
    this.projectionUniforms.projectionView.value.copy(this.projector.matrixWorldInverse)
    this.projectionUniforms.projectorPosition.value.copy(this.projector.position)
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
    const damping = this.reducedMotion ? 1 : 0.08
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, damping)
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, damping)
    this.impact = THREE.MathUtils.lerp(this.impact, 0, this.reducedMotion ? 1 : 0.12)
    this.alignment = THREE.MathUtils.lerp(
      this.alignment,
      this.progress,
      this.reducedMotion ? 1 : 0.055,
    )
    this.transition = THREE.MathUtils.lerp(
      this.transition,
      this.transitionTarget,
      this.reducedMotion ? 1 : 0.07,
    )

    this.camera.position.set(
      Math.sin(this.yaw) * 7.2,
      0.15 + Math.sin(this.pitch) * 5.2,
      Math.cos(this.yaw) * 7.2 + 3,
    )
    this.camera.lookAt(0, -0.05, 0)

    const ghostWave = this.ghostPreview ? Math.max(0, Math.sin(elapsed * 3.4)) : 0
    this.projectionUniforms.reveal.value = 0.16 + this.alignment * 0.84
    this.projectionUniforms.boost.value = Math.max(ghostWave * 0.28, this.impact * 0.46)
    this.projectionUniforms.time.value = elapsed

    for (const piece of this.pieces) {
      const state = piece.userData.piece as PieceState
      piece.position.lerpVectors(state.scatterPosition, state.targetPosition, easeOut(this.alignment))
      piece.rotation.set(
        THREE.MathUtils.lerp(state.scatterRotation.x, state.targetRotation.x, easeOut(this.alignment)),
        THREE.MathUtils.lerp(state.scatterRotation.y, state.targetRotation.y, easeOut(this.alignment)),
        THREE.MathUtils.lerp(state.scatterRotation.z, state.targetRotation.z, easeOut(this.alignment)),
      )
    }

    this.root.scale.setScalar(0.92 + this.transition * 0.08 + this.impact * 0.018)
    this.root.rotation.z = (1 - this.transition) * 0.08
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

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - THREE.MathUtils.clamp(value, 0, 1), 3)
}
