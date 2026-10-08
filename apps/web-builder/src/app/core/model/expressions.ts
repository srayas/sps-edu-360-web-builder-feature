/**
 * Safe template bindings. Text props may contain `{{ path }}` placeholders that are resolved
 * against a scope object by property lookup only — nothing is ever evaluated as code.
 *
 *   {{vars.cartCount}}   application variable by name
 *   {{item.title}}       current row inside a Repeater
 *   {{index}}            zero-based row index inside a Repeater
 *   {{page.name}}        current page
 *   {{app.name}}         project name
 *   {{data.products.length}}  rows loaded for a data source (by name)
 */

export type Scope = Record<string, unknown>

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][\w]*(?:\.[\w-]+)*)\s*\}\}/g
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])

export function lookup(source: unknown, path: string): unknown {
  let current: unknown = source
  for (const key of path.split('.')) {
    if (FORBIDDEN.has(key) || current === null || current === undefined)
      return undefined
    if (Array.isArray(current) && key === 'length') return current.length
    if (typeof current !== 'object') return undefined
    if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

export function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value)) return value.map(stringify).join(', ')
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

export function hasBindings(template: string): boolean {
  PLACEHOLDER.lastIndex = 0
  return PLACEHOLDER.test(template)
}

export function interpolate(template: unknown, scope: Scope): string {
  const text = typeof template === 'string' ? template : stringify(template)
  if (!text.includes('{{')) return text
  return text.replace(PLACEHOLDER, (_, path: string) =>
    stringify(lookup(scope, path)),
  )
}

/** Truthiness used by visibility rules: empty, "false", "0", "null" and "undefined" are false. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  const text = stringify(value).trim().toLowerCase()
  return (
    !!text && !['false', '0', 'null', 'undefined', 'no', 'off'].includes(text)
  )
}

/** Parses `a|b|c` lines into trimmed cells, skipping blank lines. */
export function lines(value: unknown): string[][] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((cell) => cell.trim()))
}

/** Converts free-form text into a form field key. */
export function fieldKey(label: string): string {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_, next: string | undefined) =>
      next ? next.toUpperCase() : '',
    )
  return key.replace(/^[^a-z]+/, '') || 'field'
}
