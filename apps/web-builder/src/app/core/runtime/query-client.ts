import {
  FramedQuery,
  Rule,
  logic,
  readPath,
  runQuery,
} from '@spsedu360/json-logic'
import {
  DataSource,
  Scope,
  exprToRule,
  interpolate,
  lookup,
  safeUrl,
  stringify,
} from '../model'
import { RequestError, backoff, isRetryableStatus } from './request-queue'

export type Row = Record<string, unknown>

export interface ResolvedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][\w]*(?:\.[\w-]+)*)\s*\}\}/g

/** Interpolates a URL template, percent-encoding every substituted value. */
export function interpolateUrl(template: string, scope: Scope): string {
  return template.replace(PLACEHOLDER, (_, path: string) =>
    encodeURIComponent(stringify(lookup(scope, path))),
  )
}

/**
 * Interpolates a JSON body template. Placeholders are replaced by JSON-encoded values, so a value
 * can never break out of its position (no injection), and `"{{form}}"` inserts a whole object.
 */
export function interpolateJson(template: string, scope: Scope): string {
  if (!template.trim()) return ''
  const value = (path: string) => {
    const found = lookup(scope, path)
    return found === undefined ? null : found
  }
  let out = ''
  let inString = false
  for (let index = 0; index < template.length; index++) {
    const char = template[index]
    if (char === '{' && template[index + 1] === '{') {
      const end = template.indexOf('}}', index + 2)
      const path = end > 0 ? template.slice(index + 2, end).trim() : ''
      if (end > 0 && /^[a-zA-Z_][\w]*(?:\.[\w-]+)*$/.test(path)) {
        const wholeString =
          inString && out.endsWith('"') && template[end + 2] === '"'
        if (wholeString) {
          // "{{path}}" → the raw JSON value (object, number, …) replaces the string literal.
          out = out.slice(0, -1) + JSON.stringify(value(path))
          inString = false
          index = end + 2
        } else if (inString) {
          out += JSON.stringify(stringify(value(path))).slice(1, -1)
          index = end + 1
        } else {
          out += JSON.stringify(value(path))
          index = end + 1
        }
        continue
      }
    }
    if (char === '"' && template[index - 1] !== '\\') inString = !inString
    out += char
  }
  JSON.parse(out)
  return out
}

/** Builds the HTTP request for a REST data source from the current scope. Returns null if not allowed. */
export function resolveRequest(
  source: DataSource,
  scope: Scope,
): ResolvedRequest | null {
  const base = safeUrl(interpolateUrl(source.url, scope), true)
  if (!base) return null
  const url = new URL(
    base,
    typeof location !== 'undefined' ? location.href : 'http://localhost',
  )
  for (const pair of source.params) {
    const value = interpolate(pair.value, scope)
    if (value !== '') url.searchParams.set(pair.key, value)
  }
  const headers: Record<string, string> = {}
  for (const pair of source.headers) {
    if (/^(cookie|host|origin|referer|content-length)$/i.test(pair.key))
      continue
    headers[pair.key] = interpolate(pair.value, scope).replace(/[\r\n]/g, '')
  }
  let body: string | undefined
  if (source.method !== 'GET' && source.body.trim()) {
    body = interpolateJson(source.body, scope)
    headers['Content-Type'] = 'application/json'
  }
  return { url: url.toString(), method: source.method, headers, body }
}

/** Converts a data source's frame into an executable query with scope parameters bound in. */
export function frameQuery(
  source: DataSource,
  scope: Scope,
): { query: FramedQuery; params: Record<string, unknown> } {
  const frame = source.query
  const query: FramedQuery = {
    sort: frame.sort,
    limit: frame.limit || undefined,
    select: frame.select.length ? frame.select : undefined,
  }
  const params: Record<string, unknown> = {}
  if (frame.filter) {
    const rule = exprToRule(frame.filter)
    for (const name of paramNames(rule))
      params[name] = readPath(scope, name.split('.'))
    query.filter = rule
  }
  if (frame.transform) query.transform = exprToRule(frame.transform)
  const term = interpolate(frame.search, scope).trim()
  if (term) query.search = { term, fields: frame.searchFields }
  return { query, params }
}

/** Collects `{"param": "path"}` names in a rule. */
export function paramNames(rule: Rule, out = new Set<string>()): Set<string> {
  if (Array.isArray(rule)) for (const item of rule) paramNames(item, out)
  else if (rule && typeof rule === 'object') {
    const record = rule as Record<string, unknown>
    const keys = Object.keys(record)
    if (keys.length === 1 && keys[0] === 'param')
      out.add(String(record['param']))
    else for (const key of keys) paramNames(record[key], out)
  }
  return out
}

export function applyFrame(
  rows: Row[],
  source: DataSource,
  scope: Scope,
): { rows: Row[]; total: number } {
  const { query, params } = frameQuery(source, scope)
  if (
    !query.filter &&
    !query.search &&
    !query.sort?.length &&
    !query.limit &&
    !query.select &&
    !query.transform
  )
    return { rows, total: rows.length }
  try {
    return runQuery(rows, query, logic, params)
  } catch {
    return { rows: [], total: 0 }
  }
}

interface CacheEntry {
  at: number
  rows?: Row[]
  promise?: Promise<Row[]>
}

/**
 * Fetches REST query sources: responses are cached per resolved request, identical in-flight
 * requests share one network call, superseded requests are aborted, and transient failures
 * (network, 408/429/5xx) are retried with exponential backoff.
 */
export class QueryClient {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly controllers = new Map<string, AbortController>()

  /** Returns cached rows if still fresh (for stale-while-revalidate rendering). */
  peek(request: ResolvedRequest): Row[] | undefined {
    return this.cache.get(this.key(request))?.rows
  }

  async fetch(
    sourceId: string,
    request: ResolvedRequest,
    path: string,
    cacheSeconds: number,
    force = false,
  ): Promise<Row[]> {
    const key = this.key(request)
    const entry = this.cache.get(key)
    if (!force && entry?.rows && Date.now() - entry.at < cacheSeconds * 1000)
      return entry.rows
    if (entry?.promise) return entry.promise

    this.controllers.get(sourceId)?.abort()
    const controller = new AbortController()
    this.controllers.set(sourceId, controller)

    const promise = this.load(request, path, controller.signal)
      .then((rows) => {
        this.cache.set(key, { at: Date.now(), rows })
        if (this.cache.size > 200)
          this.cache.delete(this.cache.keys().next().value as string)
        return rows
      })
      .finally(() => {
        const current = this.cache.get(key)
        if (current?.promise === promise)
          this.cache.set(key, { at: current.at, rows: current.rows })
        if (this.controllers.get(sourceId) === controller)
          this.controllers.delete(sourceId)
      })
    this.cache.set(key, { at: entry?.at ?? 0, rows: entry?.rows, promise })
    return promise
  }

  invalidate(): void {
    this.cache.clear()
  }

  private key(request: ResolvedRequest): string {
    return `${request.method} ${request.url} ${JSON.stringify(request.headers)} ${request.body ?? ''}`
  }

  private async load(
    request: ResolvedRequest,
    path: string,
    signal: AbortSignal,
  ): Promise<Row[]> {
    for (let attempt = 0; ; attempt++) {
      try {
        const timeout = AbortSignal.timeout(15_000)
        const response = await fetch(request.url, {
          method: request.method,
          headers: { Accept: 'application/json', ...request.headers },
          body: request.body,
          credentials: 'omit',
          signal: AbortSignal.any([signal, timeout]),
        })
        if (!response.ok)
          throw new RequestError(
            `Request failed (${response.status})`,
            response.status,
            isRetryableStatus(response.status),
          )
        const body: unknown = await response.json()
        const value = path ? lookup(body, path) : body
        const list = Array.isArray(value)
          ? value
          : value && typeof value === 'object'
            ? [value]
            : []
        return list
          .slice(0, 5000)
          .map((row) =>
            row && typeof row === 'object' ? (row as Row) : { value: row },
          )
      } catch (error) {
        if (signal.aborted) throw error
        const retryable = error instanceof RequestError ? error.retryable : true
        if (!retryable || attempt >= 2 || request.method !== 'GET') throw error
        await new Promise((resolve) => setTimeout(resolve, backoff(attempt)))
      }
    }
  }
}
