// Aigram runtime bridge — canonical project implementation.
const _params =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()

const _rawOrigin = _params.get('api_origin')

export const api_origin: string | null = _rawOrigin
  ? decodeURIComponent(_rawOrigin)
  : null

export const telegramId: string | null = _params.get('telegram_id')
export const isInAigram: boolean = !!api_origin && !!telegramId

function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

function fromBase64(str: string): string {
  return decodeURIComponent(escape(atob(str)))
}

interface BridgeResult<T = unknown> {
  request_id: string
  success: boolean
  data?: T
  error?: string
}

export interface AigramResponse<T = unknown> {
  retcode: number
  errcode?: number
  msg: string
  data: T
}

export function callAigramAPI<T = unknown>(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  data: unknown = null,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    let timer: ReturnType<typeof setTimeout>
    const payload = toBase64(
      JSON.stringify({
        url,
        method,
        data,
        request_id: requestId,
        emitter: window.location.origin,
      }),
    )

    function handleResult(result: BridgeResult<T>) {
      clearTimeout(timer)
      cleanup()
      if (result.success) resolve(result.data as T)
      else reject(new Error(result.error || 'API error'))
    }

    const cbKey = '__aigram_cb_' + requestId.replace(/-/g, '_')
    ;(window as unknown as Record<string, unknown>)[cbKey] = function (
      resultJson: string,
    ) {
      try {
        const result = JSON.parse(resultJson) as BridgeResult<T>
        if (result.request_id !== requestId) return
        handleResult(result)
      } catch {
        // Ignore malformed payload and let the timeout recover.
      }
    }

    function handler(event: MessageEvent) {
      if (api_origin && event.origin !== api_origin) return
      const msg = typeof event.data === 'string' ? event.data : ''
      if (!msg.startsWith('callAPIResult-')) return
      try {
        const result = JSON.parse(
          fromBase64(msg.slice('callAPIResult-'.length)),
        ) as BridgeResult<T>
        if (result.request_id !== requestId) return
        handleResult(result)
      } catch {
        // Ignore malformed payload and let the timeout recover.
      }
    }
    window.addEventListener('message', handler)

    function cleanup() {
      window.removeEventListener('message', handler)
      try {
        delete (window as unknown as Record<string, unknown>)[cbKey]
      } catch {
        ;(window as unknown as Record<string, unknown>)[cbKey] = undefined
      }
    }

    timer = setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, 10_000)

    const w = window as unknown as {
      webkit?: {
        messageHandlers?: {
          aigram?: { postMessage: (message: string) => void }
        }
      }
    }
    if (w.webkit?.messageHandlers?.aigram) {
      w.webkit.messageHandlers.aigram.postMessage('callAPI-' + payload)
    } else {
      window.parent.postMessage('callAPI-' + payload, api_origin || '*')
    }
  })
}

