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

type DecorationState = {
  opacity: number
  scale: THREE.Vector3
}

const PAGE_WIDTH = 3.2
const PAGE_HEIGHT = 4.8
const PAGE_ASPECT = PAGE_WIDTH / PAGE_HEIGHT
const PAGE_Z = 0.2

export class SceneDirector {
  private readonly container: HTMLElement
  private readonly events: DirectorEvents
  private readonly identityTexture: IdentityTexture
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
  private readonly projector = new THREE.PerspectiveCamera(24, PAGE_ASPECT, 0.1, 40)
  private readonly clock = new THREE.Clock()
  private readonly projectedMaterial: THREE.ShaderMaterial
  private readonly projectionUniforms: ProjectionUniforms
  private readonly root = new THREE.Group()
  private readonly pieces: THREE.Object3D[] = []
  private readonly decorations: THREE.Object3D[] = []
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private progress = 0
  private alignment = 0
  private ghostPreview = false
  private running = true
  private inViewport = true
  private frame = 0
  private transition = 1
  private transitionTarget = 1
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
    this.impact = 0
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

  getDebugState() {
    const rotations = this.pieces.map((piece) =>
      Math.max(Math.abs(piece.rotation.x), Math.abs(piece.rotation.y), Math.abs(piece.rotation.z)),
    )
    const depths = this.pieces.map((piece) => piece.position.z)
    return {
      maxRotation: Math.max(0, ...rotations),
      depthSpread: depths.length ? Math.max(...depths) - Math.min(...depths) : 0,
      projectorAspect: this.projector.aspect,
      textureAspect: this.identityTexture.canvas.width / this.identityTexture.canvas.height,
    }
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

  private buildLevel(level: number) {
    this.clearRoot()
    this.projectionUniforms.accent.value.set(level === 1 ? '#4d7cff' : '#ff5b4d')
    if (level === 0) this.buildThreshold()
    if (level === 1) this.buildFoldTheatre()
    if (level === 2) this.buildOrbitPress()
    this.buildGround(level)
  }

  private buildThreshold() {
    this.buildVerticalPage(6, (index, targetX) => {
      const offset = index - 2.5
      return {
        position: [
          targetX + Math.sin(index * 1.7) * 0.12,
          (index % 2 ? 1 : -1) * 0.18,
          PAGE_Z + 0.3 + Math.abs(offset) * 0.34,
        ],
        rotation: [0, -offset * 0.16, (index % 2 ? 1 : -1) * 0.045],
      }
    })
    this.addFrame(3.72, 5.28, -0.62, '#ff5b4d', [0.02, 0.06, -0.025])
    this.addFrame(4.05, 5.58, -1.08, '#4d7cff', [-0.03, -0.08, 0.035])
    this.addFrame(4.34, 5.86, -1.5, '#f3f0e8', [0.04, 0.11, -0.045])
  }

  private buildFoldTheatre() {
    this.buildVerticalPage(8, (index, targetX) => {
      const fold = index % 2 === 0 ? -1 : 1
      return {
        position: [
          targetX,
          Math.cos(index * 1.4) * 0.12,
          PAGE_Z + 0.2 + Math.abs(index - 3.5) * 0.13,
        ],
        rotation: [0.025 * fold, 0.5 * fold, 0.025 * fold],
      }
    })
    this.addArc(1.95, 0.055, -0.8, '#4d7cff', [1.18, 0.1, 0.18])
    this.addArc(2.22, 0.045, -1.08, '#ff5b4d', [0.5, 0.28, 1.05])
  }

  private buildOrbitPress() {
    const columns = 3
    const rows = 4
    const tileWidth = PAGE_WIDTH / columns
    const tileHeight = PAGE_HEIGHT / rows
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column
        const angle = index / (columns * rows) * Math.PI * 2 - Math.PI / 2
        const targetX = -PAGE_WIDTH / 2 + tileWidth / 2 + column * tileWidth
        const targetY = PAGE_HEIGHT / 2 - tileHeight / 2 - row * tileHeight
        this.addPiece(
          new THREE.PlaneGeometry(tileWidth + 0.008, tileHeight + 0.008),
          [targetX, targetY, PAGE_Z],
          [0, 0, 0],
          {
            position: [
              Math.cos(angle) * (1.65 + row * 0.12),
              Math.sin(angle) * (2.05 + column * 0.08),
              PAGE_Z + 0.6 + Math.sin(angle * 2) * 0.72,
            ],
            rotation: [
              Math.sin(angle) * 0.28,
              Math.cos(angle) * 0.62,
              angle + Math.PI / 2,
            ],
          },
        )
      }
    }
    this.addArc(1.82, 0.065, -0.72, '#ff5b4d', [0.9, 0.16, 0.18])
    this.addArc(2.18, 0.045, -1.12, '#4d7cff', [0.3, 0.38, 1.08])
    this.addArc(2.48, 0.035, -1.46, '#f3f0e8', [1.34, -0.18, 0.52])
  }

  private buildVerticalPage(
    count: number,
    scatterFor: (
      index: number,
      targetX: number,
    ) => {
      position: [number, number, number]
      rotation: [number, number, number]
    },
  ) {
    const pieceWidth = PAGE_WIDTH / count
    for (let index = 0; index < count; index += 1) {
      const targetX = -PAGE_WIDTH / 2 + pieceWidth / 2 + index * pieceWidth
      this.addPiece(
        new THREE.PlaneGeometry(pieceWidth + 0.008, PAGE_HEIGHT + 0.008),
        [targetX, 0, PAGE_Z],
        [0, 0, 0],
        scatterFor(index, targetX),
      )
    }
  }

  private addPiece(
    geometry: THREE.BufferGeometry,
    position: [number, number, number],
    rotation: [number, number, number],
    scatter: {
      position: [number, number, number]
      rotation: [number, number, number]
    },
  ) {
    const mesh = new THREE.Mesh(geometry, this.projectedMaterial)
    const targetPosition = new THREE.Vector3(...position)
    const targetRotation = new THREE.Euler(...rotation)
    const scatterPosition = new THREE.Vector3(...scatter.position)
    const scatterRotation = new THREE.Euler(...scatter.rotation)
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

  private addFrame(
    width: number,
    height: number,
    z: number,
    color: THREE.ColorRepresentation,
    rotation: [number, number, number],
  ) {
    const source = new THREE.BoxGeometry(width, height, 0.04)
    const edges = new THREE.EdgesGeometry(source)
    source.dispose()
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.58,
    })
    const frame = new THREE.LineSegments(edges, material)
    frame.position.z = z
    frame.rotation.set(...rotation)
    this.addDecoration(frame, material.opacity)
  }

  private addArc(
    radius: number,
    tube: number,
    z: number,
    color: THREE.ColorRepresentation,
    rotation: [number, number, number],
  ) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.52,
    })
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 96), material)
    arc.position.z = z
    arc.rotation.set(...rotation)
    this.addDecoration(arc, material.opacity)
  }

  private addDecoration(object: THREE.Object3D, opacity: number) {
    object.userData.decoration = {
      opacity,
      scale: object.scale.clone(),
    } satisfies DecorationState
    this.root.add(object)
    this.decorations.push(object)
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
    this.pieces.length = 0
    this.decorations.length = 0
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.projector.aspect = PAGE_ASPECT
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
    this.impact = THREE.MathUtils.lerp(this.impact, 0, this.reducedMotion ? 1 : 0.12)
    const alignmentDamping = this.reducedMotion ? 1 : this.progress >= 1 ? 0.16 : 0.075
    this.alignment = THREE.MathUtils.lerp(this.alignment, this.progress, alignmentDamping)
    if (this.progress >= 1 && this.alignment > 0.995) this.alignment = 1
    this.transition = THREE.MathUtils.lerp(
      this.transition,
      this.transitionTarget,
      this.reducedMotion ? 1 : 0.07,
    )

    this.camera.position.set(0, 0.1, 10.2)
    this.camera.lookAt(0, 0, PAGE_Z)

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

    const decorVisibility = 1 - easeOut(this.alignment)
    for (const decoration of this.decorations) {
      const state = decoration.userData.decoration as DecorationState
      decoration.visible = decorVisibility > 0.015
      decoration.scale.copy(state.scale).multiplyScalar(0.72 + decorVisibility * 0.28)
      const material = decoration instanceof THREE.LineSegments
        ? decoration.material
        : (decoration as THREE.Mesh).material
      const materials = Array.isArray(material) ? material : [material]
      materials.forEach((entry) => {
        entry.opacity = state.opacity * decorVisibility
      })
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
