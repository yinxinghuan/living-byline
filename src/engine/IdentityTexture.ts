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
    const editions = [
      {
        accent: '#ff5b4d',
        second: '#3156ff',
        number: '01',
        kicker: 'THE ARCHIVE OF A LIVING NAME',
        headline: 'A NAME BECOMES A PLACE',
        body: 'Identity is not a label fixed to one surface. It changes with distance, angle and the person who is looking.',
        note: 'TURN THE ROOM / HOLD THE VIEW / READ THE WHOLE',
      },
      {
        accent: '#3156ff',
        second: '#ff5b4d',
        number: '02',
        kicker: 'TYPE / DISTANCE / MEMORY',
        headline: 'FOLD SPACE INTO LANGUAGE',
        body: 'Every plane carries a fragment. Perspective edits the fragments into one continuous voice.',
        note: 'NEAR AND FAR / EDGE AND FACE / ONE COMPOSITION',
      },
      {
        accent: '#ff5b4d',
        second: '#3156ff',
        number: '03',
        kicker: 'AN ORBIT AROUND IDENTITY',
        headline: 'STILL MOVING. STILL YOURS.',
        body: 'The layout survives every interruption. At one precise coordinate the system remembers how to speak.',
        note: 'PROJECTED / ALIGNED / PRINTED WITH ALTERU',
      },
    ][level]
    return `<div style="box-sizing:border-box;width:100%;height:100%;padding:58px 58px 54px;background:#f3f0e8;color:#07090d;font-family:Arial,Helvetica,PingFang SC,sans-serif;display:grid;grid-template-rows:auto 420px 1fr auto;gap:34px;overflow:hidden">
      <header style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start;border-top:8px solid #07090d;padding-top:20px">
        <div style="font:900 21px/1 Arial,sans-serif;letter-spacing:.19em">LIVING BYLINE®</div>
        <div style="text-align:right;font:700 19px/1.35 Arial,sans-serif;letter-spacing:.12em">${platform.toUpperCase()}<br/>ISSUE ${editions.number}</div>
      </header>
      <section style="position:relative;display:grid;grid-template-columns:64% 36%;overflow:hidden;background:${editions.accent}">
        <div style="position:relative;z-index:2;display:flex;flex-direction:column;justify-content:space-between;padding:34px 30px 30px;color:#f3f0e8">
          <span style="font:800 18px/1 Arial,sans-serif;letter-spacing:.16em">${editions.kicker}</span>
          <strong style="max-width:640px;font:900 ${nameSize(this.name)}px/.82 Arial Black,Arial,PingFang SC,sans-serif;letter-spacing:-.075em;overflow-wrap:anywhere">${safeName}</strong>
          <span style="font:900 25px/1 Arial,sans-serif;letter-spacing:.08em">× ${platform.toUpperCase()}</span>
        </div>
        <div style="position:relative;background:${editions.second}">
          <div style="position:absolute;left:-106px;top:62px;width:246px;height:246px;border:30px solid #f3f0e8;border-radius:50%"></div>
          <div style="position:absolute;right:20px;bottom:-25px;color:#07090d;font:900 230px/.8 Arial Black,Arial,sans-serif;letter-spacing:-.12em">${editions.number}</div>
        </div>
      </section>
      <main style="display:grid;grid-template-columns:38% 1fr;gap:34px;border-top:4px solid #07090d;padding-top:30px">
        <div style="display:flex;flex-direction:column;justify-content:space-between;border-right:4px solid #07090d;padding-right:28px">
          <span style="font:800 18px/1.3 Arial,sans-serif;letter-spacing:.14em">ALTERU EDITORIAL<br/>IDENTITY STUDY<br/>VOL. ${editions.number}</span>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            <i style="height:62px;background:${editions.accent}"></i>
            <i style="height:62px;background:#07090d"></i>
            <i style="height:62px;background:${editions.second}"></i>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;justify-content:space-between;min-width:0">
          <h1 style="margin:0;font:900 92px/.86 Arial Black,Arial,PingFang SC,sans-serif;letter-spacing:-.07em">${editions.headline}</h1>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;padding-top:28px;border-top:3px solid #07090d">
            <p style="margin:0;font:700 24px/1.28 Arial,sans-serif">${editions.body}</p>
            <p style="margin:0;font:500 20px/1.42 Arial,sans-serif">A continuous composition can live on many surfaces. The image is complete only when movement, depth and attention share the same point of view.</p>
          </div>
        </div>
      </main>
      <footer style="display:grid;grid-template-columns:1fr auto;gap:20px;align-items:end;border-top:8px solid #07090d;padding-top:18px">
        <strong style="font:900 22px/1 Arial,sans-serif;letter-spacing:.12em">${editions.note}</strong>
        <span style="font:700 18px/1 Arial,sans-serif;letter-spacing:.14em">${editions.number} / 03</span>
      </footer>
    </div>`
  }

  private renderCanvasFallback(level: number) {
    const ctx = this.context
    ctx.fillStyle = '#f3f0e8'
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.fillStyle = level === 1 ? '#4d7cff' : '#ff5b4d'
    ctx.fillRect(58, 150, 908, 420)
    ctx.fillStyle = level === 1 ? '#ff5b4d' : '#3156ff'
    ctx.fillRect(700, 150, 266, 420)
    ctx.fillStyle = '#f3f0e8'
    ctx.font = '900 118px Arial'
    ctx.fillText(this.name.slice(0, 12), 82, 440, 610)
    ctx.font = '800 38px Arial'
    ctx.fillText(`× ${this.platform.toUpperCase()}`, 84, 520)
    ctx.fillStyle = '#07090d'
    ctx.font = '900 86px Arial'
    ctx.fillText(['A NAME BECOMES', 'FOLD SPACE INTO', 'STILL MOVING.'][level], 70, 850, 880)
    ctx.font = '700 34px Arial'
    ctx.fillText('IDENTITY / DISTANCE / ONE PRECISE VIEW', 70, 1410)
  }

  dispose() {
    this.texture.dispose()
  }
}

function nameSize(name: string) {
  const count = Array.from(name).length
  if (count > 14) return 70
  if (count > 9) return 88
  return 112
}

function escapeMarkup(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
