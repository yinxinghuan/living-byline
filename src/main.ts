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

type DebugState = {
  yaw: number
  pitch: number
  targetYaw: number
  targetPitch: number
  angularError: number
  alignment: number
  depthSpread: number
  geometryKinds: string[]
  objectCount: number
  transformChecksum: number
  projectorAspect: number
  textureAspect: number
}

declare global {
  interface Window {
    __livingByline?: {
      level: number
      alignment: number
      complete: boolean
      identitySource: 'query' | 'player' | 'brand'
      debug: () => DebugState | undefined
      goToLevel: (level: number) => Promise<void>
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
let alignment = 0
let complete = false
let nearLock = false
let ghostTimer = 0
let ghostEndTimer = 0
let completionTimer = 0
let identitySource: 'query' | 'player' | 'brand' = 'brand'
const sound = new SoundEngine()

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
      onAlignment: updateAlignment,
      onComplete: completeLevel,
      onInteraction: stopGhost,
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
      <section class="lb-align" aria-label="${copy.touch}">
        <div class="lb-align__reticle" aria-hidden="true">
          <i></i><i></i><span data-align-value>00</span>
        </div>
        <div class="lb-align__copy">
          <strong data-instruction>${copy.touch}</strong>
          <span>${copy.drag}</span>
        </div>
      </section>
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
  const action = document.querySelector<HTMLButtonElement>('.lb-complete__action')
  const retry = document.querySelector<HTMLButtonElement>('.lb-error button')
  action?.addEventListener('pointerdown', handleAction)
  action?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void handleAction()
    }
  })
  retry?.addEventListener('pointerdown', () => location.reload())
  window.addEventListener('keydown', handleKeydown)
  updateLevelUi()
  updateAlignment(0)
}

function handleKeydown(event: KeyboardEvent) {
  if (!director || complete) {
    if (event.key.toLowerCase() === 'r' && level === 2 && complete) void handleAction()
    return
  }
  const step = event.shiftKey ? 0.08 : 0.035
  if (event.key === 'ArrowLeft') director.nudgeView(step, 0)
  if (event.key === 'ArrowRight') director.nudgeView(-step, 0)
  if (event.key === 'ArrowUp') director.nudgeView(0, -step)
  if (event.key === 'ArrowDown') director.nudgeView(0, step)
}

function updateAlignment(value: number) {
  alignment = Math.max(0, Math.min(1, value))
  const game = document.querySelector<HTMLElement>('.lb-game')
  game?.style.setProperty('--lb-alignment', alignment.toFixed(3))
  const valueLabel = document.querySelector<HTMLElement>('[data-align-value]')
  if (valueLabel) valueLabel.textContent = String(Math.round(alignment * 100)).padStart(2, '0')
  const instruction = document.querySelector<HTMLElement>('[data-instruction]')
  if (instruction) {
    instruction.textContent = alignment > 0.9 ? copy.hold : alignment > 0.64 ? copy.near : copy.touch
  }
  game?.classList.toggle('is-near', alignment > 0.82 && !complete)
  if (alignment > 0.84 && !nearLock && !complete) {
    nearLock = true
    sound.pin(level)
    navigator.vibrate?.(10)
  }
  if (alignment < 0.72) nearLock = false
  syncQa()
}

function completeLevel(completedLevel: number) {
  if (complete || completedLevel !== level) return
  stopGhost()
  complete = true
  alignment = 1
  document.querySelector('.lb-game')?.classList.add('is-complete')
  const instruction = document.querySelector<HTMLElement>('[data-instruction]')
  if (instruction) instruction.textContent = copy.view
  navigator.vibrate?.([18, 28, 24])
  window.clearTimeout(completionTimer)
  completionTimer = window.setTimeout(() => {
    sound.complete(level === 2)
    updateCompleteUi()
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 380)
  syncQa()
}

async function handleAction() {
  if (!director || !complete) return
  const panel = document.querySelector<HTMLElement>('.lb-complete')
  panel?.setAttribute('hidden', '')
  complete = false
  nearLock = false
  alignment = 0
  document.querySelector('.lb-game')?.classList.remove('is-complete', 'is-near')
  if (level < 2) {
    level += 1
    await director.goToLevel(level)
  } else {
    level = 0
    await director.restart()
  }
  updateLevelUi()
  updateAlignment(0)
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
    director?.setGhostPreview(true)
    ghostEndTimer = window.setTimeout(stopGhost, 2400)
  }, 760)
}

function stopGhost() {
  window.clearTimeout(ghostTimer)
  window.clearTimeout(ghostEndTimer)
  document.querySelector('.lb-ghost')?.classList.remove('is-showing')
  director?.setGhostPreview(false)
}

function showError(error: Error) {
  console.error(error)
  document.querySelector<HTMLElement>('.lb-error')?.removeAttribute('hidden')
  document.querySelector<HTMLElement>('.lb-align')?.setAttribute('hidden', '')
  document.querySelector('.lb-boot')?.classList.add('is-ready')
}

function syncQa() {
  window.__livingByline = {
    level,
    alignment,
    complete,
    identitySource,
    debug: () => director?.getDebugState(),
    goToLevel: async (nextLevel: number) => {
      if (!director) return
      level = Math.max(0, Math.min(2, nextLevel))
      complete = false
      nearLock = false
      alignment = 0
      document.querySelector('.lb-game')?.classList.remove('is-complete', 'is-near')
      document.querySelector<HTMLElement>('.lb-complete')?.setAttribute('hidden', '')
      await director.goToLevel(level)
      updateLevelUi()
      updateAlignment(0)
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
