import './style.css'
import { SoundEngine } from './audio'
import { SceneDirector } from './engine/SceneDirector'
import { detectLocale, t } from './i18n'
import {
  callAigramAPI,
  isInAigram,
  telegramId,
} from './shared/runtime/bridge'

type ProfileResponse = {
  retcode: number
  data?: {
    name?: string
    user_name?: string
    head_url?: string
  }
}

declare global {
  interface Window {
    __livingByline?: {
      level: number
      pins: number
      complete: boolean
      identitySource: 'query' | 'player' | 'brand'
      activateNext: () => void
      goToLevel: (level: number) => Promise<void>
      debug: () => {
        maxRotation: number
        depthSpread: number
        projectorAspect: number
        textureAspect: number
      } | undefined
    }
  }
}

const locale = detectLocale()
const copy = t(locale)
const params = new URLSearchParams(location.search)
const baseline = params.get('baseline') === '1'
const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('#app missing')

let director: SceneDirector | null = null
let level = 0
let pins = 0
let complete = false
let ghostTimer = 0
let ghostEndTimer = 0
let completionTimer = 0
let routePointerId: number | null = null
let identitySource: 'query' | 'player' | 'brand' = 'brand'
const sound = new SoundEngine()

const routes = [
  [[18, 38], [78, 50], [34, 76]],
  [[18, 64], [50, 38], [82, 64]],
  [[24, 68], [50, 36], [78, 64]],
] as const

void start()

async function start() {
  const identity = await resolveIdentity()
  renderShell(identity.name)
  if (params.get('qa_error') === '1') {
    showError(new Error('QA forced projection error'))
    document.body.dataset.visualReady = 'true'
    return
  }
  const stage = document.querySelector<HTMLElement>('.lb-stage')
  if (!stage) throw new Error('Stage missing')

  director = new SceneDirector(
    stage,
    { name: identity.name, platform: 'AlterU' },
    {
      onError: showError,
    },
  )

  await director.init()
  requestAnimationFrame(() => {
    document.body.dataset.visualReady = 'true'
    document.querySelector('.lb-boot')?.classList.add('is-ready')
  })
  bindUi()
  if (!baseline) scheduleGhost()
  syncQa()
}

async function resolveIdentity() {
  const override = params.get('user_name')?.trim()
  if (override) {
    identitySource = 'query'
    return { name: clampName(override) }
  }
  if (isInAigram && telegramId) {
    try {
      const response = await callAigramAPI<ProfileResponse>(
        `/note/telegram/user/get/info/by/telegram_id?telegram_id=${encodeURIComponent(telegramId)}`,
        'GET',
      )
      const playerName = response?.data?.name?.trim() || response?.data?.user_name?.trim()
      if (playerName) {
        identitySource = 'player'
        return { name: clampName(playerName) }
      }
    } catch {
      // Outside a responsive platform bridge, retain the explicit brand fallback.
    }
  }
  identitySource = 'brand'
  return { name: 'AlterU' }
}

function renderShell(name: string) {
  app!.innerHTML = `
    <section class="lb-game${baseline ? ' lb-game--baseline' : ''}">
      <div class="lb-stage" aria-label="${copy.title}"></div>
      <div class="lb-vignette" aria-hidden="true"></div>
      <header class="lb-hud">
        <div class="lb-hud__identity">
          <span>${copy.subtitle}</span>
          <strong>${escapeMarkup(name)}</strong>
        </div>
        <div class="lb-hud__level">
          <span>${copy.level} <b data-level-number>01</b> / 03</span>
          <strong data-level-title>${copy.levels[0]}</strong>
        </div>
      </header>
      <div class="lb-register lb-register--left" aria-hidden="true"><i></i><i></i></div>
      <div class="lb-register lb-register--right" aria-hidden="true"><i></i><i></i></div>
      <section class="lb-route" aria-label="${copy.trace}">
        <svg class="lb-route__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path data-route-base pathLength="1"></path>
          <path data-route-active pathLength="1"></path>
        </svg>
        ${[0, 1, 2].map((index) => `
          <button class="lb-route__node" data-route-node="${index}" type="button" aria-label="${copy.node} ${index + 1}">
            <span>${index + 1}</span>
          </button>`).join('')}
      </section>
      <section class="lb-progress" aria-label="${copy.touch}">
        <div class="lb-progress__pins" aria-hidden="true">
          <i></i><i></i><i></i>
        </div>
        <p data-instruction>${copy.touch}</p>
      </section>
      <p class="lb-hidden-hint">${copy.drag}</p>
      <div class="lb-ghost" aria-hidden="true">
        <i></i>
        <svg viewBox="0 0 24 24">
          <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.92-1.38z"/>
        </svg>
      </div>
      <section class="lb-complete" hidden aria-live="polite">
        <div class="lb-complete__copy">
          <span data-complete-kicker>${copy.printed}</span>
          <strong data-complete-title>${copy.complete}</strong>
          <div class="lb-stamps" aria-label="${copy.complete}">
            ${copy.stamps.map((stamp, index) => `<i data-stamp="${index}">${stamp}</i>`).join('')}
          </div>
        </div>
        <button class="lb-complete__action" type="button">
          <span data-action-label>${copy.next}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h10.2l-3.6-3.6L13 6l6 6-6 6-1.4-1.4 3.6-3.6H5z"/></svg>
        </button>
      </section>
      <section class="lb-error" hidden role="alert">
        <div class="lb-error__mark" aria-hidden="true"><span></span><span></span></div>
        <span>${copy.errorTitle}</span>
        <strong>${escapeMarkup(name)} × ALTERU</strong>
        <p>${copy.errorBody}</p>
        <button type="button">${copy.retry}</button>
      </section>
    </section>`
}

function bindUi() {
  const route = document.querySelector<HTMLElement>('.lb-route')
  const action = document.querySelector<HTMLButtonElement>('.lb-complete__action')
  const retry = document.querySelector<HTMLButtonElement>('.lb-error button')
  route?.addEventListener('pointerdown', handleRoutePointerDown)
  route?.addEventListener('pointermove', handleRoutePointerMove)
  route?.addEventListener('pointerup', handleRoutePointerUp)
  route?.addEventListener('pointercancel', handleRoutePointerUp)
  route?.addEventListener('keydown', handleRouteKeydown)
  action?.addEventListener('pointerdown', handleAction)
  action?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void handleAction()
    }
  })
  retry?.addEventListener('pointerdown', () => location.reload())
  window.addEventListener('keydown', handleKeydown)
  updateRouteUi()
}

function handleKeydown(event: KeyboardEvent) {
  if (!director) return
  if (event.key === 'Enter' && !complete) activateRouteStep()
  if (event.key.toLowerCase() === 'r' && level === 2 && complete) void handleAction()
}

function handleRoutePointerDown(event: PointerEvent) {
  if (complete || routePointerId !== null) return
  stopGhost()
  routePointerId = event.pointerId
  const route = event.currentTarget as HTMLElement
  route.setPointerCapture(event.pointerId)
  route.classList.add('is-tracing')
  checkRouteHit(event.clientX, event.clientY)
}

function handleRoutePointerMove(event: PointerEvent) {
  if (event.pointerId !== routePointerId || complete) return
  checkRouteHit(event.clientX, event.clientY)
}

function handleRoutePointerUp(event: PointerEvent) {
  if (event.pointerId !== routePointerId) return
  const route = event.currentTarget as HTMLElement
  route.classList.remove('is-tracing')
  if (route.hasPointerCapture(event.pointerId)) route.releasePointerCapture(event.pointerId)
  routePointerId = null
}

function handleRouteKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (!target.matches('[data-route-node]')) return
  if ((event.key === 'Enter' || event.key === ' ') && Number(target.dataset.routeNode) === pins) {
    event.preventDefault()
    activateRouteStep()
  }
}

function checkRouteHit(clientX: number, clientY: number) {
  const active = document.querySelector<HTMLElement>(`[data-route-node="${pins}"]`)
  if (!active) return
  const rect = active.getBoundingClientRect()
  const forgiveness = 14
  if (
    clientX >= rect.left - forgiveness &&
    clientX <= rect.right + forgiveness &&
    clientY >= rect.top - forgiveness &&
    clientY <= rect.bottom + forgiveness
  ) {
    activateRouteStep()
  }
}

function activateRouteStep() {
  if (!director || complete || pins >= 3) return
  stopGhost()
  sound.pin(pins)
  pins += 1
  director.setAssemblyProgress(pins / 3)
  navigator.vibrate?.(pins === 3 ? [18, 24, 24] : 12)
  updatePinUi()
  updateRouteUi()
  syncQa()
  if (pins === 3) {
    complete = true
    document.querySelector('.lb-game')?.classList.add('is-complete')
    document.querySelector('.lb-route')?.classList.add('is-complete')
    updatePinUi()
    window.clearTimeout(completionTimer)
    completionTimer = window.setTimeout(() => {
      sound.complete(level === 2)
      updateCompleteUi()
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 520)
    syncQa()
  }
}

async function handleAction() {
  if (!director || !complete) return
  const panel = document.querySelector<HTMLElement>('.lb-complete')
  panel?.setAttribute('hidden', '')
  complete = false
  document.querySelector('.lb-game')?.classList.remove('is-complete')
  pins = 0
  if (level < 2) {
    level += 1
    await director.goToLevel(level)
  } else {
    level = 0
    await director.restart()
  }
  updateLevelUi()
  updatePinUi()
  updateRouteUi()
  scheduleGhost()
  syncQa()
}

function updateLevelUi() {
  const number = document.querySelector<HTMLElement>('[data-level-number]')
  const title = document.querySelector<HTMLElement>('[data-level-title]')
  if (number) number.textContent = String(level + 1).padStart(2, '0')
  if (title) title.textContent = copy.levels[level]
  document.querySelectorAll<HTMLElement>('[data-stamp]').forEach((stamp) => {
    stamp.classList.toggle('is-active', Number(stamp.dataset.stamp) < level)
  })
  const instruction = document.querySelector<HTMLElement>('[data-instruction]')
  if (instruction) instruction.textContent = copy.touch
}

function updatePinUi() {
  document.querySelectorAll<HTMLElement>('.lb-progress__pins i').forEach((pin, index) => {
    pin.classList.toggle('is-active', index < pins)
  })
  const instruction = document.querySelector<HTMLElement>('[data-instruction]')
  if (instruction) {
    instruction.textContent = complete ? copy.view : `${copy.touch} · ${pins}/3`
  }
}

function updateRouteUi() {
  const points = routes[level]
  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  document.querySelectorAll<SVGPathElement>('[data-route-base], [data-route-active]').forEach((line) => {
    line.setAttribute('d', path)
  })
  const activeLine = document.querySelector<SVGPathElement>('[data-route-active]')
  if (activeLine) activeLine.style.strokeDasharray = `${pins / 3} 1`
  document.querySelectorAll<HTMLElement>('[data-route-node]').forEach((node, index) => {
    const [x, y] = points[index]
    node.style.setProperty('--lb-node-x', `${x}%`)
    node.style.setProperty('--lb-node-y', `${y}%`)
    node.classList.toggle('is-active', index < pins)
    node.classList.toggle('is-current', index === pins && !complete)
    node.setAttribute('aria-current', index === pins && !complete ? 'step' : 'false')
    node.tabIndex = index === pins && !complete ? 0 : -1
  })
  document.querySelector('.lb-route')?.classList.toggle('is-complete', complete)
}

function updateCompleteUi() {
  const panel = document.querySelector<HTMLElement>('.lb-complete')
  const label = document.querySelector<HTMLElement>('[data-action-label]')
  const kicker = document.querySelector<HTMLElement>('[data-complete-kicker]')
  panel?.removeAttribute('hidden')
  if (label) label.textContent = level === 2 ? copy.replay : copy.next
  if (kicker) kicker.textContent = level === 2 ? copy.printed : copy.levels[level]
  document.querySelectorAll<HTMLElement>('[data-stamp]').forEach((stamp) => {
    stamp.classList.toggle('is-active', Number(stamp.dataset.stamp) <= level)
  })
}

function scheduleGhost() {
  stopGhost()
  if (baseline) return
  ghostTimer = window.setTimeout(() => {
    document.querySelector('.lb-ghost')?.classList.add('is-showing')
    document.querySelector('.lb-route')?.classList.add('is-previewing')
    director?.setGhostPreview(true)
    ghostEndTimer = window.setTimeout(stopGhost, 2600)
  }, 720)
}

function stopGhost() {
  window.clearTimeout(ghostTimer)
  window.clearTimeout(ghostEndTimer)
  document.querySelector('.lb-ghost')?.classList.remove('is-showing')
  document.querySelector('.lb-route')?.classList.remove('is-previewing')
  director?.setGhostPreview(false)
}

function showError(error: Error) {
  console.error(error)
  document.querySelector<HTMLElement>('.lb-error')?.removeAttribute('hidden')
  document.querySelector<HTMLElement>('.lb-progress')?.setAttribute('hidden', '')
  document.querySelector('.lb-boot')?.classList.add('is-ready')
}

function syncQa() {
  window.__livingByline = {
    level,
    pins,
    complete,
    identitySource,
    activateNext: activateRouteStep,
    debug: () => director?.getDebugState(),
    goToLevel: async (nextLevel: number) => {
      if (!director) return
      level = Math.max(0, Math.min(2, nextLevel))
      pins = 0
      complete = false
      document.querySelector('.lb-game')?.classList.remove('is-complete')
      await director.goToLevel(level)
      updateLevelUi()
      updatePinUi()
      updateRouteUi()
      syncQa()
    },
  }
}

function clampName(value: string) {
  return Array.from(value).slice(0, 18).join('') || 'AlterU'
}

function escapeMarkup(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
