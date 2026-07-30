import * as THREE from 'three'

type IdentityTextureOptions = {
  name: string
  platform: string
  avatarDataUrl: string
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
  private readonly avatarDataUrl: string

  constructor({
    name,
    platform,
    avatarDataUrl,
    width = 1024,
    height = 1536,
  }: IdentityTextureOptions) {
    this.width = width
    this.height = height
    this.name = name
    this.platform = platform
    this.avatarDataUrl = avatarDataUrl
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
    const avatar = escapeMarkup(this.avatarDataUrl)
    const editions = [
      {
        accent: '#ff5b4d',
        second: '#3156ff',
        number: '01',
        kicker: 'A NAME / IN ONE PRECISE VIEW',
      },
      {
        accent: '#3156ff',
        second: '#ff5b4d',
        number: '02',
        kicker: 'A FACE / HELD BY DISTANCE',
      },
      {
        accent: '#ff5b4d',
        second: '#3156ff',
        number: '03',
        kicker: 'YOU / SEEN FROM EVERY SIDE',
      },
    ][level]
    const name = `${Math.min(190, nameSize(this.name) * 1.55)}px`
    const compositions = [
      `<div style="position:absolute;inset:0;background:#f3f0e8;color:#07090d;overflow:hidden">
        <div style="position:absolute;left:-178px;top:-128px;width:940px;height:940px">${alterULogo('#07090d')}</div>
        <div style="position:absolute;right:0;top:0;width:176px;height:100%;background:${editions.accent}"></div>
        <div style="position:absolute;right:48px;top:54px;font:900 210px/.76 Arial Black,Arial,sans-serif;color:#f3f0e8;letter-spacing:-.14em;writing-mode:vertical-rl">${editions.number}</div>
        <div style="position:absolute;left:68px;right:228px;bottom:88px">
          <span style="display:block;margin-bottom:24px;font:800 20px/1 Arial,sans-serif;letter-spacing:.19em">${editions.kicker}</span>
          <strong style="display:block;font:900 ${name}/.78 Arial Black,Arial,PingFang SC,sans-serif;letter-spacing:-.08em;overflow-wrap:anywhere">${safeName}</strong>
        </div>
      </div>`,
      `<div style="position:absolute;inset:0;background:${editions.accent};color:#f3f0e8;overflow:hidden">
        <div style="position:absolute;right:0;top:0;width:29%;height:100%;overflow:hidden;background:#07090d">
          <img src="${avatar}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center"/>
        </div>
        <div style="position:absolute;left:-188px;top:84px;width:960px;height:960px">${alterULogo('#f3f0e8')}</div>
        <div style="position:absolute;right:34px;top:52px;font:900 205px/.76 Arial Black,Arial,sans-serif;color:${editions.second};letter-spacing:-.14em">${editions.number}</div>
        <div style="position:absolute;left:62px;right:34%;bottom:74px">
          <span style="display:block;margin-bottom:22px;font:800 20px/1.15 Arial,sans-serif;letter-spacing:.17em">${editions.kicker}</span>
          <strong style="display:block;font:900 ${Math.max(72, nameSize(this.name) * 1.08)}px/.78 Arial Black,Arial,PingFang SC,sans-serif;letter-spacing:-.08em;overflow-wrap:anywhere">${safeName}</strong>
        </div>
      </div>`,
      `<div style="position:absolute;inset:0;background:#07090d;color:#f3f0e8;overflow:hidden">
        <div style="position:absolute;left:102px;top:-122px;width:900px;height:900px">${alterULogo('#f3f0e8')}</div>
        <div style="position:absolute;left:0;right:0;top:700px;height:304px;overflow:hidden;background:${editions.second}">
          <img src="${avatar}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center 42%"/>
        </div>
        <div style="position:absolute;left:62px;right:60px;bottom:72px;display:flex;align-items:flex-end;justify-content:space-between;gap:36px">
          <strong style="max-width:760px;font:900 ${name}/.76 Arial Black,Arial,PingFang SC,sans-serif;letter-spacing:-.085em;overflow-wrap:anywhere">${safeName}</strong>
          <div style="flex:none;color:${editions.accent};font:900 230px/.7 Arial Black,Arial,sans-serif;letter-spacing:-.15em">${editions.number}</div>
        </div>
        <span style="position:absolute;left:64px;top:52px;font:800 20px/1 Arial,sans-serif;letter-spacing:.19em">${editions.kicker}</span>
      </div>`,
    ]
    return `<div style="position:relative;width:100%;height:100%;overflow:hidden;font-family:Arial,Helvetica,PingFang SC,sans-serif">
      ${compositions[level]}
      <div style="position:absolute;right:34px;bottom:28px;font:800 17px/1 Arial,sans-serif;letter-spacing:.18em;color:${level === 0 ? '#07090d' : '#f3f0e8'}">${platform.toUpperCase()} / 0${level + 1}</div>
    </div>`
  }

  private renderCanvasFallback(level: number) {
    const ctx = this.context
    ctx.fillStyle = '#f3f0e8'
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.fillStyle = level === 1 ? '#4d7cff' : '#ff5b4d'
    ctx.fillRect(level === 0 ? 848 : 0, 0, level === 0 ? 176 : 1024, 1536)
    ctx.fillStyle = '#07090d'
    ctx.font = '900 146px Arial'
    ctx.fillText(this.name.slice(0, 12), 62, 1370, 760)
    ctx.font = '800 28px Arial'
    ctx.fillText(`${this.platform.toUpperCase()} / 0${level + 1}`, 64, 1480)
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

function alterULogo(fill: string) {
  return `<svg width="100%" height="100%" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M170.98 80.6864C175.826 80.3379 179.093 82.8464 180.922 87.1309C184.554 95.5742 179.373 98.9845 175.515 105.325C163.859 124.48 165.503 149.557 163.744 170.582C161.932 192.259 154.492 222.584 132.269 231.923C124.974 234.989 114.517 234.372 107.397 231.013C70.2537 212.926 93.1286 160.103 105.525 133.265C109.335 126.098 112.98 118.784 117.907 112.277C121.491 107.547 127.748 104.724 132.998 108.827C135.386 110.694 136.494 114.684 135.563 117.517C133.513 123.752 129.105 129.175 126.136 135.017C117.204 151.711 107.57 173.577 108.149 192.736C108.648 197.729 110.443 203.949 114.709 207.163C121.717 212.44 129.246 209.446 133.613 202.772C139.289 194.091 141.378 184.867 142.431 174.855C143.583 164.684 143.524 154.864 144.04 144.611C144.994 125.736 146.094 103.972 158.412 88.4443C161.509 84.5388 165.905 81.2324 170.98 80.6864Z" fill="${fill}"/>
    <path d="M86.9111 55.8511C87.5972 55.021 88.2531 54.3294 88.9727 53.5417C91.25 52.4699 98.6717 56.4898 104.848 54.7181C114.926 51.8253 124.216 44.6228 133.929 32.5885C137.352 28.3472 139.875 23.9207 143.53 19.8896C144.863 19.2069 144.275 19.3179 145.281 19.7403C145.408 20.3861 145.647 21.0867 144.974 22.1183C129.708 45.5149 124.762 63.0491 135.86 73.3957C137.561 74.9843 140.36 76.5377 141.933 78.4606L140.234 80.9976C139.451 81.6669 139.143 82.0962 138.465 81.9081C133.792 80.6128 129.85 79.3599 124.485 79.4064C114.232 79.4902 104.957 91.2197 95.9169 103.826C93.848 106.711 90.2527 112.469 87.8923 114.692C86.2512 115.246 86.8375 115.356 85.9333 114.646C86.1422 111.648 90.6859 105.295 92.5935 101.966C103.729 82.5318 103.185 67.3286 93.9942 61.1122C92.4408 60.0674 87.4627 58.0224 86.9111 55.8511Z" fill="${fill}"/>
  </svg>`
}
