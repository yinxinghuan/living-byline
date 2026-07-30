import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const root = '/Users/yin/code/games/living-byline'
const port = '61289'
const evidenceRound = 'flat-print-rework'
const vite = `${root}/node_modules/vite/bin/vite.js`
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', port], {
  cwd: root,
  stdio: 'ignore',
})
await mkdir(`${root}/_qa/ui`, { recursive: true })
await new Promise((resolve) => setTimeout(resolve, 1200))

const browser = await chromium.launch({ headless: true })
const failures = []

async function traceRoute(page) {
  const points = await page.locator('[data-route-node]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }),
  )
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: points[0].x, y: points[0].y, id: 1 }],
  })
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    for (let step = 1; step <= 10; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{
          x: from.x + (to.x - from.x) * (step / 10),
          y: from.y + (to.y - from.y) * (step / 10),
          id: 1,
        }],
      })
      await page.waitForTimeout(12)
    }
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}

async function assertFlatPrint(page, label, stage) {
  const debug = await page.evaluate(() => window.__livingByline?.debug())
  if (!debug) {
    failures.push(`${label} ${stage}: missing projection debug state`)
    return
  }
  if (Math.abs(debug.projectorAspect - debug.textureAspect) > 0.0001) {
    failures.push(
      `${label} ${stage}: projector aspect ${debug.projectorAspect} != texture ${debug.textureAspect}`,
    )
  }
  if (debug.maxRotation > 0.025) {
    failures.push(`${label} ${stage}: completed page rotation ${debug.maxRotation}`)
  }
  if (debug.depthSpread > 0.025) {
    failures.push(`${label} ${stage}: completed page depth spread ${debug.depthSpread}`)
  }
}

for (const [label, width, height] of [
  ['390x844', 390, 844],
  ['320x568', 320, 568],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  page.on('pageerror', (error) => failures.push(`${label}: ${error.stack || error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`${label} console: ${message.text()}`)
  })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: {
        messageHandlers: {
          aigram: {
            postMessage(message) {
              if (typeof message !== 'string' || !message.startsWith('callAPI-')) return
              const payload = JSON.parse(atob(message.slice('callAPI-'.length)))
              setTimeout(() => {
                const callback = window[`__aigram_cb_${payload.request_id.replaceAll('-', '_')}`]
                callback?.(
                  JSON.stringify({
                    request_id: payload.request_id,
                    success: true,
                    data: {
                      retcode: 0,
                      data: {
                        name: '平台林思远ULTRALONG',
                        head_url: 'https://different-origin.invalid/no-cors-avatar.jpg',
                      },
                    },
                  }),
                )
              }, 24)
            },
          },
        },
      },
    })
  })
  await page.goto(
    `http://127.0.0.1:${port}/?api_origin=https%3A%2F%2Faigram.app&telegram_id=739201`,
    { waitUntil: 'domcontentloaded' },
  )
  await page.waitForFunction(() => document.body.dataset.visualReady === 'true')
  await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  await page.waitForTimeout(900)

  const identity = await page.evaluate(() => window.__livingByline?.identitySource)
  if (identity !== 'player') failures.push(`${label}: identity source was ${identity}`)
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    ready: document.body.dataset.visualReady,
  }))
  if (metrics.width > metrics.viewport) {
    failures.push(`${label}: horizontal overflow ${metrics.width} > ${metrics.viewport}`)
  }
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-entry-platform-layout-${label}.png`,
  })

  await traceRoute(page)
  await page.waitForFunction(() => window.__livingByline?.complete === true)
  await page.waitForTimeout(900)
  await assertFlatPrint(page, label, 'level1')
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-level1-complete-platform-layout-${label}.png`,
  })

  await page.locator('.lb-complete__action').click()
  await page.waitForFunction(() => window.__livingByline?.level === 1)
  await page.waitForTimeout(900)
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-level2-platform-layout-${label}.png`,
  })

  await traceRoute(page)
  await page.waitForFunction(() => window.__livingByline?.complete === true)
  await page.waitForTimeout(900)
  await assertFlatPrint(page, label, 'level2')
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-level2-complete-platform-layout-${label}.png`,
  })
  await page.locator('.lb-complete__action').click()
  await page.waitForFunction(() => window.__livingByline?.level === 2)
  await page.waitForTimeout(900)
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-level3-platform-layout-${label}.png`,
  })

  await traceRoute(page)
  await page.waitForFunction(() => window.__livingByline?.complete === true)
  await page.waitForTimeout(900)
  await assertFlatPrint(page, label, 'level3')
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-final-platform-layout-${label}.png`,
  })
  await page.close()
}

const external = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
})
await external.goto(`http://127.0.0.1:${port}/?user_name=AlterU`, {
  waitUntil: 'domcontentloaded',
})
await external.waitForFunction(() => document.body.dataset.visualReady === 'true')
await external.waitForTimeout(900)
const bannerVisible = await external.locator('#alteru-guest-banner').isVisible().catch(() => false)
if (!bannerVisible) failures.push('external-guest: banner not visible')
await external.screenshot({
  path: `${root}/_qa/ui/${evidenceRound}-entry-external-guest-390x844.png`,
})
await external.close()

const errorPage = await browser.newPage({
  viewport: { width: 320, height: 568 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
})
await errorPage.goto(`http://127.0.0.1:${port}/?user_name=林思远ALPHA&qa_error=1`, {
  waitUntil: 'domcontentloaded',
})
await errorPage.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await errorPage.screenshot({
  path: `${root}/_qa/ui/${evidenceRound}-error-platform-layout-320x568.png`,
})
await errorPage.close()

await browser.close()
server.kill('SIGTERM')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
