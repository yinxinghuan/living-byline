import * as THREE from 'three'

type IdentityTextureOptions = {
  name: string
  platform: string
  width?: number
  height?: number
}

export class IdentityTexture {
  readonly canvas: HTMLCanvasElement
  readonly texture: THREE.CanvasTexture
  private readonly context: CanvasRenderingContext2D
  private readonly width: number
  private readonly height: number
  private readonly name: string
  private readonly platform: string

  constructor({
    name,
    platform,
    width = 1024,
    height = 1536,
  }: IdentityTextureOptions) {
    this.width = width
    this.height = height
    this.name = name
    this.platform = platform
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    const context = this.canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D unavailable')
    this.context = context
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
  }

  async render(level: number) {
    const markup = this.markup(level)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${this.width}px;height:${this.height}px">${markup}</div>
      </foreignObject>
    </svg>`
    const image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    try {
      await image.decode()
      this.context.clearRect(0, 0, this.width, this.height)
      this.context.drawImage(image, 0, 0, this.width, this.height)
    } catch {
      this.renderCanvasFallback(level)
    }
    this.texture.needsUpdate = true
  }

  private markup(level: number) {
    const safeName = escapeMarkup(this.name)
    const platform = escapeMarkup(this.platform)
    const phrases = [
      ['A NAME', 'BECOMES', 'A PLACE'],
      ['FOLD THE', 'DISTANCE', 'INTO TYPE'],
      ['PRINTED', 'IN ORBIT', 'STILL YOURS'],
    ][level]
    const coral = level === 1 ? '#4d7cff' : '#ff5b4d'
    const blue = level === 1 ? '#ff5b4d' : '#4d7cff'
    const rows = phrases
      .map(
        (phrase, index) =>
          `<div style="font-size:${112 - index * 8}px;font-weight:900;line-height:.88;letter-spacing:-.07em;text-align:${index % 2 ? 'right' : 'left'}">${phrase}</div>`,
      )
      .join('')
    return `<div style="box-sizing:border-box;width:100%;height:100%;padding:86px 74px;background:#f3f0e8;color:#07090d;font-family:Arial Black,Arial,PingFang SC,sans-serif;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;font:700 22px/1 Arial,sans-serif;letter-spacing:.16em">
        <span>LIVING BYLINE / 0${level + 1}</span><span>${platform.toUpperCase()}</span>
      </div>
      <div style="position:relative;padding:54px 0;border-top:4px solid #07090d;border-bottom:4px solid #07090d">${rows}
        <div style="position:absolute;left:${level * 12 + 8}%;top:22%;width:62%;height:42%;background:${coral};mix-blend-mode:multiply;transform:rotate(${level * 3 - 3}deg)"></div>
        <div style="position:absolute;right:4%;bottom:8%;width:34%;height:24%;border:18px solid ${blue};border-radius:50%;mix-blend-mode:multiply"></div>
      </div>
      <div>
        <div style="font-size:${nameSize(this.name)}px;font-weight:900;line-height:.86;letter-spacing:-.07em;overflow-wrap:anywhere">${safeName}</div>
        <div style="margin-top:24px;display:flex;align-items:center;gap:22px;font:800 31px/1 Arial,sans-serif;letter-spacing:.08em">
          <span style="display:inline-block;width:72px;height:18px;background:${coral}"></span>
          <span>× ${platform.toUpperCase()}</span>
        </div>
      </div>
    </div>`
  }

  private renderCanvasFallback(level: number) {
    const ctx = this.context
    ctx.fillStyle = '#f3f0e8'
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.fillStyle = '#07090d'
    ctx.font = '900 124px Arial'
    ctx.fillText(this.name.slice(0, 12), 72, 1020, 880)
    ctx.font = '800 48px Arial'
    ctx.fillText(`× ${this.platform.toUpperCase()}`, 76, 1110)
    ctx.fillStyle = level === 1 ? '#4d7cff' : '#ff5b4d'
    ctx.fillRect(72, 260, 720, 420)
    ctx.fillStyle = '#07090d'
    ctx.font = '900 92px Arial'
    ctx.fillText(['A NAME', 'FOLD TYPE', 'IN ORBIT'][level], 92, 480)
  }

  dispose() {
    this.texture.dispose()
  }
}

function nameSize(name: string) {
  const count = Array.from(name).length
  if (count > 14) return 96
  if (count > 9) return 122
  return 152
}

function escapeMarkup(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

