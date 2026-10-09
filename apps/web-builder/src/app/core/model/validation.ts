/**
 * Field validation: rule definitions for the studio, the checks used by rendered fields, and
 * parsing of field errors returned by servers. Pure functions (no Angular), so they are unit
 * tested and shared by every field type.
 */
import { truthy } from '@spsedu360/json-logic'
import { evaluateExpr } from './logic'
import type { ValidationKind, ValidationRule } from './types'

export type ValidationValueKind =
  | 'none'
  | 'number'
  | 'text'
  | 'pattern'
  | 'field'

export interface ValidationDefinition {
  kind: ValidationKind
  label: string
  /** What `rule.value` holds. */
  value: ValidationValueKind
  valueLabel?: string
  hint?: string
}

export const VALIDATION_DEFINITIONS: readonly ValidationDefinition[] = [
  { kind: 'required', label: 'Required', value: 'none' },
  { kind: 'email', label: 'Email address', value: 'none' },
  { kind: 'phone', label: 'Phone number', value: 'none' },
  { kind: 'url', label: 'Web address (URL)', value: 'none' },
  { kind: 'number', label: 'Number', value: 'none' },
  { kind: 'integer', label: 'Whole number', value: 'none' },
  { kind: 'letters', label: 'Letters only', value: 'none' },
  { kind: 'alphanumeric', label: 'Letters and digits only', value: 'none' },
  {
    kind: 'minLength',
    label: 'Minimum length',
    value: 'number',
    valueLabel: 'Characters (or items)',
  },
  {
    kind: 'maxLength',
    label: 'Maximum length',
    value: 'number',
    valueLabel: 'Characters (or items)',
  },
  {
    kind: 'min',
    label: 'Minimum value',
    value: 'text',
    valueLabel: 'Number or date (YYYY-MM-DD)',
    hint: 'Use {{…}} to compare with another value',
  },
  {
    kind: 'max',
    label: 'Maximum value',
    value: 'text',
    valueLabel: 'Number or date (YYYY-MM-DD)',
    hint: 'Use {{…}} to compare with another value',
  },
  {
    kind: 'pattern',
    label: 'Matches a pattern',
    value: 'pattern',
    valueLabel: 'Regular expression',
  },
  {
    kind: 'matchField',
    label: 'Matches another field',
    value: 'field',
    valueLabel: 'Field',
  },
  {
    kind: 'custom',
    label: 'Custom condition',
    value: 'none',
    hint: 'Passes while the condition is true; the value is {{value}}',
  },
]

export function validationDefinition(
  kind: string,
): ValidationDefinition | undefined {
  return VALIDATION_DEFINITIONS.find((item) => item.kind === kind)
}

export function createValidation(kind: ValidationKind): ValidationRule {
  const rule: ValidationRule = { id: crypto.randomUUID(), kind }
  if (kind === 'minLength') rule.value = '3'
  if (kind === 'maxLength') rule.value = '100'
  if (kind === 'min') rule.value = '0'
  if (kind === 'max') rule.value = '100'
  if (kind === 'pattern') rule.value = '^[A-Z]{2}[0-9]{4}$'
  if (kind === 'custom')
    rule.expr = {
      kind: 'conditions',
      group: {
        combinator: 'and',
        conditions: [
          { field: 'value', operator: 'not_empty', source: 'literal' },
        ],
      },
    }
  return rule
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^\+?[0-9 ()\-.]{7,20}$/
const LETTERS = /^[\p{L}\p{M} '\-]+$/u
const ALPHANUMERIC = /^[\p{L}\p{M}\p{N}]+$/u
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  value === false ||
  (Array.isArray(value) && value.length === 0)

const size = (value: unknown) =>
  Array.isArray(value) ? value.length : String(value ?? '').length

/** Comparable form of a value: dates as timestamps, otherwise numbers (NaN when not numeric). */
function comparable(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  const text = String(value ?? '').trim()
  if (ISO_DATE.test(text)) return Date.parse(text)
  return text === '' ? Number.NaN : Number(text)
}

/** `{{path}}` limits are read from the scope so rules can compare with other fields. */
function resolveLimit(
  value: string | undefined,
  scope: Record<string, unknown>,
): unknown {
  const match = /^\s*\{\{\s*([\w.-]+)\s*\}\}\s*$/.exec(value ?? '')
  if (!match) return value
  return match[1]
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      scope,
    )
}

function compiledPattern(source: string | undefined): RegExp | null {
  if (!source || source.length > 500) return null
  try {
    return new RegExp(source, 'u')
  } catch {
    return null
  }
}

export function defaultMessage(rule: ValidationRule, label: string): string {
  const name = label || 'This field'
  switch (rule.kind) {
    case 'required':
      return `${name} is required.`
    case 'email':
      return 'Enter a valid email address.'
    case 'phone':
      return 'Enter a valid phone number.'
    case 'url':
      return 'Enter a valid web address, starting with https://.'
    case 'number':
      return 'Enter a number.'
    case 'integer':
      return 'Enter a whole number.'
    case 'letters':
      return 'Use letters only.'
    case 'alphanumeric':
      return 'Use letters and digits only.'
    case 'minLength':
      return `Use at least ${rule.value} characters.`
    case 'maxLength':
      return `Use at most ${rule.value} characters.`
    case 'min':
      return `Must be ${rule.value?.includes('{{') ? 'higher' : `at least ${rule.value}`}.`
    case 'max':
      return `Must be ${rule.value?.includes('{{') ? 'lower' : `at most ${rule.value}`}.`
    case 'pattern':
      return 'The value does not match the expected format.'
    case 'matchField':
      return 'The values do not match.'
    case 'custom':
      return `${name} is not valid.`
  }
}

/** True when `value` satisfies the rule (conditional rules whose `when` is false always pass). */
export function passes(
  rule: ValidationRule,
  value: unknown,
  scope: Record<string, unknown> = {},
): boolean {
  if (rule.when && !truthy(evaluateExpr(rule.when, { ...scope, value }, false)))
    return true
  if (rule.kind === 'required') return !isEmpty(value)
  if (rule.kind === 'custom')
    return (
      !rule.expr || truthy(evaluateExpr(rule.expr, { ...scope, value }, false))
    )
  if (rule.kind === 'matchField') {
    const fields = (scope['fields'] ?? {}) as Record<string, unknown>
    return String(value ?? '') === String(fields[rule.value ?? ''] ?? '')
  }
  // Every other rule only checks values that are present; use "Required" for presence.
  if (isEmpty(value)) return true
  const text = Array.isArray(value) ? '' : String(value).trim()
  switch (rule.kind) {
    case 'email':
      return EMAIL.test(text)
    case 'phone':
      return PHONE.test(text) && text.replace(/\D/g, '').length >= 7
    case 'url':
      try {
        const url = new URL(text)
        return url.protocol === 'https:' || url.protocol === 'http:'
      } catch {
        return false
      }
    case 'number':
      return text !== '' && Number.isFinite(Number(text))
    case 'integer':
      return text !== '' && Number.isInteger(Number(text))
    case 'letters':
      return LETTERS.test(text)
    case 'alphanumeric':
      return ALPHANUMERIC.test(text)
    case 'minLength':
      return size(value) >= (Number(rule.value) || 0)
    case 'maxLength':
      return !(Number(rule.value) > 0) || size(value) <= Number(rule.value)
    case 'min': {
      const limit = comparable(resolveLimit(rule.value, scope))
      const current = comparable(value)
      return Number.isNaN(limit) || Number.isNaN(current) || current >= limit
    }
    case 'max': {
      const limit = comparable(resolveLimit(rule.value, scope))
      const current = comparable(value)
      return Number.isNaN(limit) || Number.isNaN(current) || current <= limit
    }
    case 'pattern': {
      const pattern = compiledPattern(rule.value)
      return !pattern || pattern.test(text)
    }
  }
  return true
}

/** The message of the first failing rule, or '' when the value is valid. */
export function validateValue(
  rules: readonly ValidationRule[],
  value: unknown,
  scope: Record<string, unknown>,
  label: string,
): string {
  for (const rule of rules)
    if (!passes(rule, value, scope))
      return rule.message?.trim() || defaultMessage(rule, label)
  return ''
}

/** Scope paths the rules read (other fields, variables…), to revalidate when those change. */
export function ruleDependencies(rules: readonly ValidationRule[]): boolean {
  return rules.some(
    (rule) =>
      rule.when ||
      rule.kind === 'custom' ||
      rule.kind === 'matchField' ||
      ((rule.kind === 'min' || rule.kind === 'max') &&
        rule.value?.includes('{{')),
  )
}

export interface ServerErrors {
  /** Field name → message. */
  fields: Record<string, string>
  /** Form-level message (may be empty). */
  message: string
}

const firstText = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return firstText(value[0])
  if (value && typeof value === 'object')
    return firstText(Object.values(value as Record<string, unknown>)[0])
  return ''
}

/**
 * Reads field errors from common API error shapes:
 * `{errors: {email: "Taken"}}`, `{errors: {email: ["Taken"]}}`, `{fieldErrors: {...}}`,
 * `{errors: [{field|path|name|property: "email", message|msg|constraints: …}]}` (incl.
 * class-validator), plus a form-level `message`/`error`/`detail`.
 */
export function parseServerErrors(body: unknown): ServerErrors {
  const out: ServerErrors = { fields: {}, message: '' }
  if (!body || typeof body !== 'object') {
    out.message = typeof body === 'string' ? body.slice(0, 300) : ''
    return out
  }
  const record = body as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'title']) {
    const text = firstText(record[key])
    if (text && !out.message) out.message = text.slice(0, 300)
  }
  const container =
    record['errors'] ??
    record['fieldErrors'] ??
    record['validationErrors'] ??
    (record['data'] as Record<string, unknown> | undefined)?.['errors']
  const add = (name: unknown, message: unknown) => {
    const field = String(name ?? '').trim()
    const text = firstText(message).trim()
    if (field && text && !out.fields[field])
      out.fields[field] = text.slice(0, 300)
  }
  if (Array.isArray(container)) {
    for (const entry of container.slice(0, 100)) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as Record<string, unknown>
      const name =
        item['field'] ??
        item['path'] ??
        item['name'] ??
        item['property'] ??
        item['param']
      add(
        Array.isArray(name) ? name.join('.') : name,
        item['message'] ?? item['msg'] ?? item['constraints'] ?? item['error'],
      )
    }
  } else if (container && typeof container === 'object') {
    for (const [name, message] of Object.entries(
      container as Record<string, unknown>,
    ).slice(0, 100))
      add(name, message)
  }
  return out
}
