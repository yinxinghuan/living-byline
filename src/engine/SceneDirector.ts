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
    this.addPiece(new THREE.BoxGeometry(0.42, 5.8, 0.55), [-2.25, -0.05, 0], [0, 0, -0.04], 0)
    this.addPiece(new THREE.BoxGeometry(0.42, 5.8, 0.55), [2.25, -0.05, 0], [0, 0, 0.04], 1)
    this.addPiece(new THREE.BoxGeometry(4.9, 0.38, 0.6), [0, 2.65, 0], [0, 0, 0], 2)
    for (let index = 0; index < 5; index += 1) {
      this.addPiece(
        new THREE.BoxGeometry(1.3, 2.85, 0.14),
        [(index - 2) * 0.78, -0.15 + Math.abs(index - 2) * 0.12, 0.35 + Math.abs(index - 2) * 0.42],
        [0, (index - 2) * -0.11, (index % 2 ? -1 : 1) * 0.025],
        index + 3,
      )
    }
  }

  private buildFoldTheatre() {
    for (let index = 0; index < 8; index += 1) {
      const phase = index / 7
      const x = Math.sin(phase * Math.PI * 2.2) * 0.72
      const y = -1.75 + index * 0.5
      const z = Math.cos(phase * Math.PI * 2) * 0.62
      this.addPiece(
        new THREE.BoxGeometry(4.6 - Math.abs(index - 3.5) * 0.18, 0.58, 0.16),
        [x, y, z],
        [(index % 2 ? 1 : -1) * 0.06, Math.sin(phase * Math.PI) * 0.22, (index % 2 ? 1 : -1) * 0.08],
        index,
      )
    }
    this.addPiece(new THREE.CylinderGeometry(1.2, 1.55, 0.32, 48), [0, -2.3, 0.45], [0, 0, 0], 8)
    this.addPiece(new THREE.TorusGeometry(2.55, 0.09, 12, 72, Math.PI * 1.25), [0, 0, -0.35], [0.1, 0, -0.45], 9)
  }

  private buildOrbitPress() {
    this.addPiece(new THREE.SphereGeometry(1.22, 48, 32), [0, 0.05, 0], [0, 0, 0], 0)
    this.addPiece(new THREE.TorusGeometry(2.25, 0.17, 20, 96), [0, 0.1, 0.1], [1.08, 0.18, 0.2], 1)
    this.addPiece(new THREE.TorusGeometry(2.85, 0.12, 18, 96), [0, 0.1, 0.2], [0.32, 0.42, 1.2], 2)
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI * 0.5 + 0.4
      this.addPiece(
        new THREE.BoxGeometry(1.25, 2.5, 0.13),
        [Math.cos(angle) * 2.4, Math.sin(angle) * 1.6, -0.3],
        [0.12 * Math.sin(angle), -angle + Math.PI / 2, angle + 0.2],
        index + 3,
      )
    }
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
          Math.sin(seed * 4.7 + 0.4) * 0.62,
          Math.cos(seed * 2.9 + 0.8) * 0.48,
          Math.sin(seed * 3.2) * 0.72,
        ),
      )
    const scatterRotation = new THREE.Euler(
      rotation[0] + Math.sin(seed * 2.3) * 0.34,
      rotation[1] + Math.cos(seed * 1.7) * 0.38,
      rotation[2] + Math.sin(seed * 4.1) * 0.22,
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
