import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const root = '/Users/yin/code/games/living-byline'
const port = '61289'
const evidenceRound = 'open-field-selected'
const vite = `${root}/node_modules/vite/bin/vite.js`
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', port], {
  cwd: root,
  stdio: 'ignore',
})
await mkdir(`${root}/_qa/ui`, { recursive: true })
await new Promise((resolve) => setTimeout(resolve, 1200))

const browser = await chromium.launch({ headless: true })
const failures = []

async function dragToTarget(page) {
  const before = await page.evaluate(() => window.__livingByline?.debug())
  if (!before) throw new Error('Missing debug state before drag')
  const viewport = page.viewportSize()
  const startX = Math.round((viewport?.width || 390) * 0.5)
  const startY = Math.round((viewport?.height || 844) * 0.52)
  const yawDelta = Math.atan2(
    Math.sin(before.targetYaw - before.yaw),
    Math.cos(before.targetYaw - before.yaw),
  )
  const deltaX = -yawDelta / 0.006
  const deltaY = (before.targetPitch - before.pitch) / 0.0048
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY, id: 1 }],
  })
  for (let step = 1; step <= 18; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: startX + deltaX * (step / 18),
        y: startY + deltaY * (step / 18),
        id: 1,
      }],
    })
    await page.waitForTimeout(18)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  return before
}

async function assertFreeOrbit(page, label) {
  const before = await page.evaluate(() => window.__livingByline?.debug())
  if (!before) throw new Error('Missing debug state before free orbit')
  const viewport = page.viewportSize()
  const client = await page.context().newCDPSession(page)
  for (let pass = 0; pass < 4; pass += 1) {
    const y = Math.round((viewport?.height || 844) * 0.5)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 285, y, id: 1 }],
    })
    for (let step = 1; step <= 10; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 285 - 230 * (step / 10), y, id: 1 }],
      })
      await page.waitForTimeout(12)
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const centerX = Math.round((viewport?.width || 390) * 0.5)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centerX, y: 180, id: 2 }],
  })
  for (let step = 1; step <= 10; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: centerX, y: 180 + 145 * (step / 10), id: 2 }],
    })
    await page.waitForTimeout(12)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  await page.waitForTimeout(650)
  const after = await page.evaluate(() => window.__livingByline?.debug())
  if (!after) throw new Error('Missing debug state after free orbit')
  if (Math.abs(after.yaw - before.yaw) < 4.5) {
    failures.push(`${label}: horizontal orbit remained limited (${before.yaw} → ${after.yaw})`)
  }
  if (Math.abs(after.pitch) < 0.75) {
    failures.push(`${label}: vertical orbit remained limited (${after.pitch})`)
  }
}

async function assertScene(page, label, stage, before) {
  const debug = await page.evaluate(() => window.__livingByline?.debug())
  if (!debug) {
    failures.push(`${label} ${stage}: missing projection debug state`)
    return
  }
  if (Math.abs(debug.projectorAspect - debug.textureAspect) > 0.0001) {
    failures.push(`${label} ${stage}: projector aspect does not match source texture`)
  }
  if (debug.depthSpread < 5) {
    failures.push(`${label} ${stage}: scene depth spread ${debug.depthSpread} is too flat`)
  }
  if (
    !debug.geometryKinds.includes('ExtrudeGeometry') ||
    !debug.geometryKinds.includes('SphereGeometry') ||
    !debug.geometryKinds.includes('TorusGeometry')
  ) {
    failures.push(`${label} ${stage}: scene lacks triangle, sphere, or arch geometry`)
  }
  if (debug.objectCount < 20) {
    failures.push(`${label} ${stage}: only ${debug.objectCount} scene objects`)
  }
  if (debug.mosaicPieceCount < 12 || debug.mosaicPieceCount > 36) {
    failures.push(`${label} ${stage}: mosaic piece count ${debug.mosaicPieceCount} is not hierarchical`)
  }
  if (debug.mosaicAreaRatio < 8) {
    failures.push(`${label} ${stage}: mosaic area ratio ${debug.mosaicAreaRatio} is too uniform`)
  }
  if (debug.mosaicNearShare < 0.25 || debug.mosaicNearShare > 0.75) {
    failures.push(`${label} ${stage}: near-depth share ${debug.mosaicNearShare} lacks clustering`)
  }
  if (debug.mosaicDepthSpread < 5) {
    failures.push(`${label} ${stage}: mosaic depth spread ${debug.mosaicDepthSpread} lacks outliers`)
  }
  if (before && Math.abs(before.yaw - debug.yaw) < 0.25) {
    failures.push(`${label} ${stage}: camera did not rotate materially`)
  }
  if (stage.includes('complete') && debug.angularError > 0.035) {
    failures.push(`${label} ${stage}: completed with angular error ${debug.angularError}`)
  }
  if (before && before.transformChecksum !== debug.transformChecksum) {
    failures.push(`${label} ${stage}: scene transforms changed during viewpoint alignment`)
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
                callback?.(JSON.stringify({
                  request_id: payload.request_id,
                  success: true,
                  data: {
                    retcode: 0,
                    data: { name: '平台林思远ULTRALONG', head_url: '' },
                  },
                }))
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
  }))
  if (metrics.width > metrics.viewport) failures.push(`${label}: horizontal overflow`)
  await assertScene(page, label, 'entry')
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-entry-platform-layout-${label}.png`,
  })
  await assertFreeOrbit(page, label)
  await page.screenshot({
    path: `${root}/_qa/ui/${evidenceRound}-free-orbit-platform-layout-${label}.png`,
  })

  for (let stageLevel = 0; stageLevel < 3; stageLevel += 1) {
    if (stageLevel > 0) {
      await page.locator('.lb-complete__action').click()
      await page.waitForFunction((expected) => window.__livingByline?.level === expected, stageLevel)
      await page.waitForTimeout(700)
      await page.screenshot({
        path: `${root}/_qa/ui/${evidenceRound}-level${stageLevel + 1}-entry-platform-layout-${label}.png`,
      })
    }
    const before = await dragToTarget(page)
    await page.waitForFunction(() => window.__livingByline?.complete === true, undefined, { timeout: 5000 })
    await page.waitForTimeout(550)
    await assertScene(page, label, `level${stageLevel + 1}-complete`, before)
    await page.screenshot({
      path: `${root}/_qa/ui/${evidenceRound}-level${stageLevel + 1}-complete-platform-layout-${label}.png`,
    })
  }
  await page.close()
}

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

const externalPage = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
})
await externalPage.goto(`http://127.0.0.1:${port}/?user_name=AlterU`, {
  waitUntil: 'domcontentloaded',
})
await externalPage.waitForFunction(() => document.body.dataset.visualReady === 'true')
await externalPage.waitForTimeout(1200)
await externalPage.screenshot({
  path: `${root}/_qa/ui/${evidenceRound}-entry-external-guest-390x844.png`,
})
await externalPage.close()

await browser.close()
server.kill('SIGTERM')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
