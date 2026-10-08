import { signal } from '@angular/core'

export interface QueuedRequest {
  /** Stable id used as the Idempotency-Key header, so retries and replays are safe server-side. */
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  /** Human-readable label for status messages. */
  label: string
  attempts: number
  createdAt: number
}

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly retryable = false,
  ) {
    super(message)
  }
}

const OUTBOX_KEY = 'wb-outbox'
const MAX_OUTBOX = 200

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

/** Exponential backoff with full jitter: ~300ms, ~900ms, ~2.7s … capped at 10s. */
export const backoff = (attempt: number) =>
  Math.min(10_000, 300 * 3 ** attempt) * (0.5 + Math.random() * 0.5)

export const isRetryableStatus = (status: number) =>
  status === 0 ||
  status === 408 ||
  status === 425 ||
  status === 429 ||
  status >= 500

/**
 * Sends mutations (form submissions, API calls) with bounded concurrency and automatic retries.
 * While the browser is offline, requests wait in a persisted outbox and are replayed in order
 * when the connection returns — also after a reload.
 */
export class RequestQueue {
  readonly pending = signal(0)
  readonly offline = signal(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  )
  private running = 0
  private readonly waiting: (() => void)[] = []

  constructor(
    private readonly concurrency = 4,
    private readonly maxAttempts = 4,
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.offline.set(false)
        void this.flushOutbox()
      })
      window.addEventListener('offline', () => this.offline.set(true))
      queueMicrotask(() => void this.flushOutbox())
    }
  }

  /** Runs a request through the queue and resolves with the parsed JSON (or text) response. */
  async send(
    request: Omit<QueuedRequest, 'attempts' | 'createdAt'>,
  ): Promise<unknown> {
    const item: QueuedRequest = {
      ...request,
      attempts: 0,
      createdAt: Date.now(),
    }
    if (this.offline()) {
      this.persist(item)
      throw new RequestError(
        'You are offline. The request was saved and will be sent automatically.',
        0,
        false,
      )
    }
    this.pending.update((count) => count + 1)
    try {
      return await this.withSlot(() => this.attempt(item))
    } catch (error) {
      if (error instanceof RequestError && error.retryable && this.offline())
        this.persist(item)
      throw error
    } finally {
      this.pending.update((count) => count - 1)
    }
  }

  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency)
      await new Promise<void>((resolve) => this.waiting.push(resolve))
    this.running++
    try {
      return await task()
    } finally {
      this.running--
      this.waiting.shift()?.()
    }
  }

  private async attempt(item: QueuedRequest): Promise<unknown> {
    for (;;) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 20_000)
        const response = await fetch(item.url, {
          method: item.method,
          headers: {
            Accept: 'application/json',
            'Idempotency-Key': item.id,
            ...item.headers,
          },
          body: item.body,
          credentials: 'same-origin',
          signal: controller.signal,
        }).finally(() => clearTimeout(timer))
        if (!response.ok)
          throw new RequestError(
            `Request failed (${response.status})`,
            response.status,
            isRetryableStatus(response.status),
          )
        const text = await response.text()
        try {
          return text ? JSON.parse(text) : null
        } catch {
          return text
        }
      } catch (error) {
        const failure =
          error instanceof RequestError
            ? error
            : new RequestError('Network error', 0, true)
        item.attempts++
        if (!failure.retryable || item.attempts >= this.maxAttempts)
          throw failure
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.offline.set(true)
          throw failure
        }
        await sleep(backoff(item.attempts - 1))
      }
    }
  }

  private persist(item: QueuedRequest): void {
    try {
      const outbox: QueuedRequest[] = JSON.parse(
        localStorage.getItem(OUTBOX_KEY) ?? '[]',
      )
      if (!outbox.some((entry) => entry.id === item.id)) outbox.push(item)
      localStorage.setItem(
        OUTBOX_KEY,
        JSON.stringify(outbox.slice(-MAX_OUTBOX)),
      )
    } catch {
      /* storage unavailable: the request is lost, and the caller was told */
    }
  }

  /** Replays saved requests in order; keeps the ones that still fail with a retryable error. */
  async flushOutbox(): Promise<number> {
    let outbox: QueuedRequest[]
    try {
      outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]')
    } catch {
      return 0
    }
    if (!outbox.length || this.offline()) return 0
    const remaining: QueuedRequest[] = []
    let sent = 0
    for (const item of outbox) {
      try {
        await this.withSlot(() => this.attempt({ ...item, attempts: 0 }))
        sent++
      } catch (error) {
        if (error instanceof RequestError && error.retryable)
          remaining.push(item)
      }
    }
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining))
    } catch {
      /* ignore */
    }
    return sent
  }
}
