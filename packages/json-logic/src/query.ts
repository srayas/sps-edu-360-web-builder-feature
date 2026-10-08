/**
 * Framed queries: structured, validated descriptions of "which rows, in which order, which
 * fields" — the user never writes query text. The same executor runs in the browser (static data,
 * collections, REST results) and on the server (stored collections).
 *
 * Parameters are bound into the rule before compilation (`{"param": "name"}` becomes a literal),
 * so parameter values can never change the shape of the query, and constant parts fold away.
 */
import {
  LogicEngine,
  LogicError,
  Rule,
  readPath,
  splitPath,
  truthy,
} from './engine'
import { compareValues } from './operators'

export type Row = Record<string, unknown>

export interface SortSpec {
  field: string
  direction: 'asc' | 'desc'
}

export interface FramedQuery {
  /** JSON Logic predicate evaluated against each row. */
  filter?: Rule
  /** Case-insensitive text search across the given fields. */
  search?: { term: string; fields: string[] }
  sort?: SortSpec[]
  offset?: number
  limit?: number
  /** Keep only these fields (dot paths allowed; output keys use the full path). */
  select?: string[]
  /** JSON Logic applied to each row after filtering to reshape it. */
  transform?: Rule
}

export interface QueryResult {
  rows: Row[]
  /** Rows matching the filter and search before paging. */
  total: number
}

export const QUERY_LIMITS = {
  maxLimit: 1000,
  maxSort: 5,
  maxSelect: 50,
  maxSearchFields: 20,
  maxTerm: 200,
}
const FIELD = /^[A-Za-z_$][\w$-]*(\.[\w$-]+)*$/

/** Replaces `{"param": "name"}` nodes with the parameter's value. Unknown parameters become null. */
export function bindParams(rule: Rule, params: Record<string, unknown>): Rule {
  if (Array.isArray(rule)) return rule.map((item) => bindParams(item, params))
  if (!rule || typeof rule !== 'object') return rule
  const keys = Object.keys(rule)
  if (keys.length === 1 && keys[0] === 'param') {
    const name = String((rule as Record<string, unknown>)['param'])
    const value = Object.prototype.hasOwnProperty.call(params, name)
      ? params[name]
      : null
    // Wrap arrays/objects so they stay literal values instead of being read as rules.
    return value !== null && typeof value === 'object'
      ? { preserve: value }
      : (value ?? null)
  }
  const out: Record<string, unknown> = {}
  for (const key of keys)
    out[key] = bindParams((rule as Record<string, unknown>)[key], params)
  return out
}

/** Validates the shape of a framed query and returns a normalised copy. Throws LogicError. */
export function normalizeQuery(
  query: FramedQuery | undefined,
  engine: LogicEngine,
): FramedQuery {
  const q = query ?? {}
  const out: FramedQuery = {}
  if (q.filter !== undefined && q.filter !== null && q.filter !== true) {
    const check = engine.validate(q.filter)
    if (!check.ok) throw new LogicError(`Invalid filter: ${check.error}`)
    out.filter = q.filter
  }
  if (q.transform !== undefined && q.transform !== null) {
    const check = engine.validate(q.transform)
    if (!check.ok) throw new LogicError(`Invalid transform: ${check.error}`)
    out.transform = q.transform
  }
  if (q.search && String(q.search.term ?? '').trim()) {
    const fields = (q.search.fields ?? [])
      .filter((field) => FIELD.test(field))
      .slice(0, QUERY_LIMITS.maxSearchFields)
    out.search = {
      term: String(q.search.term).slice(0, QUERY_LIMITS.maxTerm),
      fields,
    }
  }
  if (q.sort?.length) {
    out.sort = q.sort
      .filter((item) => item && FIELD.test(item.field))
      .slice(0, QUERY_LIMITS.maxSort)
      .map((item) => ({
        field: item.field,
        direction: item.direction === 'desc' ? 'desc' : 'asc',
      }))
  }
  if (q.select?.length)
    out.select = q.select
      .filter((field) => FIELD.test(field))
      .slice(0, QUERY_LIMITS.maxSelect)
  out.offset = Math.max(0, Math.floor(Number(q.offset) || 0))
  const limit = Math.floor(Number(q.limit) || 0)
  out.limit =
    limit > 0 ? Math.min(limit, QUERY_LIMITS.maxLimit) : QUERY_LIMITS.maxLimit
  return out
}

/** Executes a framed query over rows. */
export function runQuery(
  rows: readonly unknown[],
  query: FramedQuery | undefined,
  engine: LogicEngine,
  params: Record<string, unknown> = {},
): QueryResult {
  const q = normalizeQuery(query, engine)
  let result = rows.filter(
    (row): row is Row =>
      !!row && typeof row === 'object' && !Array.isArray(row),
  )

  if (q.filter !== undefined) {
    const predicate = engine.compile(bindParams(q.filter, params))
    result = result.filter((row) => truthy(predicate(row)))
  }
  if (q.search) {
    const term = q.search.term.toLowerCase()
    const paths = (
      q.search.fields.length ? q.search.fields : Object.keys(result[0] ?? {})
    ).map(splitPath)
    result = result.filter((row) =>
      paths.some((path) => {
        const value = readPath(row, path)
        return (
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(term)
        )
      }),
    )
  }
  const total = result.length
  if (q.sort?.length) {
    const sorts = q.sort.map((item) => ({
      path: splitPath(item.field),
      sign: item.direction === 'desc' ? -1 : 1,
    }))
    result = result
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        for (const { path, sign } of sorts) {
          const order = compareValues(
            readPath(a.row, path),
            readPath(b.row, path),
          )
          if (order) return sign * order
        }
        return a.index - b.index
      })
      .map((entry) => entry.row)
  }
  result = result.slice(
    q.offset,
    (q.offset ?? 0) + (q.limit ?? QUERY_LIMITS.maxLimit),
  )
  if (q.transform !== undefined) {
    const shape = engine.compile(bindParams(q.transform, params))
    result = result.map((row) => {
      const value = shape(row)
      return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Row)
        : { value }
    })
  }
  if (q.select?.length) {
    const paths = q.select.map((field) => [field, splitPath(field)] as const)
    result = result.map((row) => {
      const out: Row = {}
      for (const [field, path] of paths)
        out[field] = readPath(row, path) ?? null
      return out
    })
  }
  return { rows: result, total }
}

// ---------------------------------------------------------------------------------------------
// Visual conditions <-> JSON Logic
// ---------------------------------------------------------------------------------------------

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains'
  | 'not_contains'
  | 'starts'
  | 'ends'
  | 'in'
  | 'not_in'
  | 'empty'
  | 'not_empty'
  | 'true'
  | 'false'

/** Where a comparison value comes from. */
export type ValueSource = 'literal' | 'param' | 'field'

export interface Condition {
  field: string
  operator: ConditionOperator
  value?: unknown
  value2?: unknown
  source?: ValueSource
}

export interface ConditionGroup {
  combinator: 'and' | 'or'
  conditions: (Condition | ConditionGroup)[]
}

export const CONDITION_OPERATORS: {
  value: ConditionOperator
  label: string
  arity: 0 | 1 | 2
}[] = [
  { value: 'eq', label: 'equals', arity: 1 },
  { value: 'neq', label: 'does not equal', arity: 1 },
  { value: 'gt', label: 'is greater than', arity: 1 },
  { value: 'gte', label: 'is at least', arity: 1 },
  { value: 'lt', label: 'is less than', arity: 1 },
  { value: 'lte', label: 'is at most', arity: 1 },
  { value: 'between', label: 'is between', arity: 2 },
  { value: 'contains', label: 'contains', arity: 1 },
  { value: 'not_contains', label: 'does not contain', arity: 1 },
  { value: 'starts', label: 'starts with', arity: 1 },
  { value: 'ends', label: 'ends with', arity: 1 },
  { value: 'in', label: 'is one of', arity: 1 },
  { value: 'not_in', label: 'is not one of', arity: 1 },
  { value: 'empty', label: 'is empty', arity: 0 },
  { value: 'not_empty', label: 'is not empty', arity: 0 },
  { value: 'true', label: 'is true', arity: 0 },
  { value: 'false', label: 'is false', arity: 0 },
]

export const isGroup = (
  item: Condition | ConditionGroup,
): item is ConditionGroup => 'combinator' in item

function operand(condition: Condition, value: unknown): Rule {
  if (condition.source === 'param') return { param: String(value ?? '') }
  if (condition.source === 'field') return { var: String(value ?? '') }
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value)) &&
    ['gt', 'gte', 'lt', 'lte', 'between'].includes(condition.operator)
  )
    return Number(value)
  return value ?? null
}

export function conditionToLogic(condition: Condition): Rule {
  const field = { var: condition.field }
  const a = operand(condition, condition.value)
  const b = operand(condition, condition.value2)
  const list = (value: Rule): Rule =>
    (condition.source === 'literal' || !condition.source) &&
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : value
  switch (condition.operator) {
    case 'eq':
      return { '==': [field, a] }
    case 'neq':
      return { '!=': [field, a] }
    case 'gt':
      return { '>': [field, a] }
    case 'gte':
      return { '>=': [field, a] }
    case 'lt':
      return { '<': [field, a] }
    case 'lte':
      return { '<=': [field, a] }
    case 'between':
      return { '<=': [a, field, b] }
    case 'contains':
      return { contains: [field, a] }
    case 'not_contains':
      return { '!': { contains: [field, a] } }
    case 'starts':
      return { starts_with: [{ lower: field }, { lower: a }] }
    case 'ends':
      return { ends_with: [{ lower: field }, { lower: a }] }
    case 'in':
      return { in: [field, list(a)] }
    case 'not_in':
      return { '!': { in: [field, list(a)] } }
    case 'empty':
      return { '!': field }
    case 'not_empty':
      return { '!!': field }
    case 'true':
      return { '==': [field, true] }
    case 'false':
      return { '!': field }
  }
}

export function groupToLogic(group: ConditionGroup): Rule {
  const parts = group.conditions
    .filter((item) =>
      isGroup(item) ? item.conditions.length > 0 : !!item.field,
    )
    .map((item) =>
      isGroup(item) ? groupToLogic(item) : conditionToLogic(item),
    )
  if (parts.length === 0) return true
  if (parts.length === 1) return parts[0]
  return { [group.combinator]: parts }
}
