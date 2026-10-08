/**
 * Operator set: every operator of the JSON Logic specification plus a documented set of
 * extensions useful for data binding (strings, numbers, arrays, objects, dates, error handling).
 */
import {
  Compiler,
  LogicError,
  LogicNode,
  OperatorDefinition,
  Rule,
  argsOf,
  constantNode,
  readKey,
  readPath,
  splitPath,
  truthy,
} from './engine'

type Ops = Record<string, OperatorDefinition>

const toNumber = (value: unknown): number =>
  typeof value === 'number' ? value : parseFloat(String(value))
const isArray = Array.isArray

// ---------------------------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------------------------

function compileVar(args: Rule[], c: Compiler): LogicNode {
  const pathNode = c.child(args[0] ?? '', 0)
  const fallbackNode =
    args.length > 1 ? c.child(args[1], 1) : constantNode(null)
  if (pathNode.k) {
    const keys = splitPath(pathNode.v)
    if (fallbackNode.k) {
      const fallback = fallbackNode.v
      if (keys.length === 0) return (data) => data
      if (keys.length === 1) {
        const key = keys[0]
        return (data) => {
          const value = readKey(data, key)
          return value === undefined || value === null ? fallback : value
        }
      }
      return (data) => {
        const value = readPath(data, keys)
        return value === undefined || value === null ? fallback : value
      }
    }
    return (data) => {
      const value = keys.length ? readPath(data, keys) : data
      return value === undefined || value === null ? fallbackNode(data) : value
    }
  }
  return (data) => {
    const keys = splitPath(pathNode(data))
    const value = keys.length ? readPath(data, keys) : data
    return value === undefined || value === null ? fallbackNode(data) : value
  }
}

function missingKeys(data: unknown, keys: unknown[]): unknown[] {
  const missing: unknown[] = []
  for (const key of keys) {
    const value = readPath(data, splitPath(key))
    if (value === null || value === undefined || value === '') missing.push(key)
  }
  return missing
}

function compileMissing(args: Rule[], c: Compiler): LogicNode {
  const nodes = args.map((arg, index) => c.child(arg, index))
  return (data) => {
    const values = nodes.map((node) => node(data))
    const keys = isArray(values[0]) ? (values[0] as unknown[]) : values
    return missingKeys(data, keys)
  }
}

function compileMissingSome(args: Rule[], c: Compiler): LogicNode {
  const need = c.child(args[0], 0)
  const keys = c.child(args[1], 1)
  return (data) => {
    const list = argsOf(keys(data)) as unknown[]
    const missing = missingKeys(data, list)
    return list.length - missing.length >= toNumber(need(data)) ? [] : missing
  }
}

// ---------------------------------------------------------------------------------------------
// Control flow (lazy)
// ---------------------------------------------------------------------------------------------

function compileIf(args: Rule[], c: Compiler): LogicNode {
  const nodes = args.map((arg, index) => c.child(arg, index))
  if (nodes.length === 0) return constantNode(null)
  if (nodes.length === 1) return nodes[0]
  // Fold a constant condition chain.
  if (nodes[0].k && nodes.length <= 3)
    return truthy(nodes[0].v) ? nodes[1] : (nodes[2] ?? constantNode(null))
  return (data) => {
    let index = 0
    for (; index < nodes.length - 1; index += 2) {
      if (truthy(nodes[index](data))) return nodes[index + 1](data)
    }
    return index === nodes.length - 1 ? nodes[index](data) : null
  }
}

function compileAnd(args: Rule[], c: Compiler): LogicNode {
  const nodes = args.map((arg, index) => c.child(arg, index))
  if (nodes.length === 0) return constantNode(undefined)
  if (nodes.length === 2) {
    const [a, b] = nodes
    return (data) => {
      const first = a(data)
      return truthy(first) ? b(data) : first
    }
  }
  return (data) => {
    let value: unknown
    for (const node of nodes) {
      value = node(data)
      if (!truthy(value)) return value
    }
    return value
  }
}

function compileOr(args: Rule[], c: Compiler): LogicNode {
  const nodes = args.map((arg, index) => c.child(arg, index))
  if (nodes.length === 0) return constantNode(undefined)
  return (data) => {
    let value: unknown
    for (const node of nodes) {
      value = node(data)
      if (truthy(value)) return value
    }
    return value
  }
}

function compileCoalesce(args: Rule[], c: Compiler): LogicNode {
  const nodes = args.map((arg, index) => c.child(arg, index))
  return (data) => {
    for (const node of nodes) {
      const value = node(data)
      if (value !== null && value !== undefined) return value
    }
    return null
  }
}

function compileTry(args: Rule[], c: Compiler): LogicNode {
  const nodes = args.map((arg, index) => c.child(arg, index))
  return (data) => {
    for (let index = 0; index < nodes.length; index++) {
      try {
        return nodes[index](data)
      } catch (error) {
        if (index === nodes.length - 1) throw error
      }
    }
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Iteration (scoped: inside the body, `var` reads the current element)
// ---------------------------------------------------------------------------------------------

function iterate(
  c: Compiler,
  args: Rule[],
  body: (
    list: unknown[],
    fn: LogicNode,
    data: unknown,
    extra: LogicNode[],
  ) => unknown,
  empty: unknown,
): LogicNode {
  const source = c.child(args[0], 0)
  const fn = args.length > 1 ? c.child(args[1], 1) : constantNode(null)
  const extra = args.slice(2).map((arg, index) => c.child(arg, index + 2))
  return (data) => {
    const list = source(data)
    if (!isArray(list))
      return typeof empty === 'function'
        ? (empty as (d: unknown) => unknown)(data)
        : empty
    c.tick(list.length)
    return body(list, fn, data, extra)
  }
}

const compileMap = (args: Rule[], c: Compiler) =>
  iterate(c, args, (list, fn) => list.map((item) => fn(item)), [])
const compileFilter = (args: Rule[], c: Compiler) =>
  iterate(c, args, (list, fn) => list.filter((item) => truthy(fn(item))), [])
const compileAll = (args: Rule[], c: Compiler) =>
  iterate(
    c,
    args,
    (list, fn) => {
      if (!list.length) return false
      for (const item of list) if (!truthy(fn(item))) return false
      return true
    },
    false,
  )
const compileSome = (args: Rule[], c: Compiler) =>
  iterate(
    c,
    args,
    (list, fn) => {
      for (const item of list) if (truthy(fn(item))) return true
      return false
    },
    false,
  )
const compileNone = (args: Rule[], c: Compiler) =>
  iterate(
    c,
    args,
    (list, fn) => {
      for (const item of list) if (truthy(fn(item))) return false
      return true
    },
    true,
  )
const compileFind = (args: Rule[], c: Compiler) =>
  iterate(
    c,
    args,
    (list, fn) => {
      for (const item of list) if (truthy(fn(item))) return item
      return null
    },
    null,
  )
const compileCountIf = (args: Rule[], c: Compiler) =>
  iterate(
    c,
    args,
    (list, fn) =>
      list.reduce(
        (count: number, item) => (truthy(fn(item)) ? count + 1 : count),
        0,
      ),
    0,
  )
const compileSumBy = (args: Rule[], c: Compiler) =>
  iterate(
    c,
    args,
    (list, fn) =>
      list.reduce((sum: number, item) => sum + (toNumber(fn(item)) || 0), 0),
    0,
  )

function compileReduce(args: Rule[], c: Compiler): LogicNode {
  const source = c.child(args[0], 0)
  const fn = c.child(args[1] ?? null, 1)
  const initial = args.length > 2 ? c.child(args[2], 2) : constantNode(null)
  return (data) => {
    const list = source(data)
    const start = initial(data)
    if (!isArray(list)) return start
    c.tick(list.length)
    let accumulator = start
    for (const current of list) accumulator = fn({ current, accumulator })
    return accumulator
  }
}

/** `{"sort_by": [list, keyRule, "asc"|"desc"]}` — stable sort by a computed key. */
function compileSortBy(args: Rule[], c: Compiler): LogicNode {
  const source = c.child(args[0], 0)
  const key =
    args.length > 1
      ? c.child(args[1], 1)
      : (((item: unknown) => item) as LogicNode)
  const direction = args.length > 2 ? c.child(args[2], 2) : constantNode('asc')
  return (data) => {
    const list = source(data)
    if (!isArray(list)) return []
    c.tick(list.length * Math.max(1, Math.ceil(Math.log2(list.length + 1))))
    const sign = String(direction(data)).toLowerCase() === 'desc' ? -1 : 1
    return list
      .map((item, index) => ({ item, index, key: key(item) }))
      .sort((a, b) => sign * compareValues(a.key, b.key) || a.index - b.index)
      .map((entry) => entry.item)
  }
}

export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const na = Number(a)
  const nb = Number(b)
  if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb))
    return na - nb
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

// ---------------------------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------------------------

/** `{"object": [["key", rule], ...]}` builds an object; keys must be literal strings. */
function compileObject(args: Rule[], c: Compiler): LogicNode {
  const entries = args.map((pair, index) => {
    if (!isArray(pair) || typeof pair[0] !== 'string')
      c.fail('object expects [["key", value], ...] pairs.')
    const [key, value] = pair as [string, Rule]
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      c.fail(`"${key}" is not an allowed key.`)
    return [key, c.child(value, index)] as const
  })
  return (data) => {
    const out: Record<string, unknown> = {}
    for (const [key, node] of entries) out[key] = node(data)
    return out
  }
}

const safeKey = (key: unknown): string => {
  const name = String(key)
  if (name === '__proto__' || name === 'constructor' || name === 'prototype')
    throw new LogicError(`"${name}" is not an allowed key.`)
  return name
}

// ---------------------------------------------------------------------------------------------
// Dates (ISO strings in, ISO strings out; UTC arithmetic)
// ---------------------------------------------------------------------------------------------

const UNITS: Record<string, number> = {
  ms: 1,
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
}

function toDate(value: unknown): Date {
  const date =
    value instanceof Date ? value : new Date(value as string | number)
  if (Number.isNaN(date.getTime()))
    throw new LogicError(`Invalid date: ${String(value)}`)
  return date
}

function addToDate(value: unknown, amount: unknown, unit: unknown): string {
  const date = toDate(value)
  const n = toNumber(amount) || 0
  const name = String(unit ?? 'day').replace(/s$/, '')
  if (name === 'month' || name === 'year') {
    const copy = new Date(date)
    copy.setUTCMonth(copy.getUTCMonth() + (name === 'year' ? n * 12 : n))
    return copy.toISOString()
  }
  const size = UNITS[name]
  if (!size) throw new LogicError(`Unknown date unit "${String(unit)}".`)
  return new Date(date.getTime() + n * size).toISOString()
}

function diffDates(a: unknown, b: unknown, unit: unknown): number {
  const ms = toDate(a).getTime() - toDate(b).getTime()
  const name = String(unit ?? 'day').replace(/s$/, '')
  const size = UNITS[name]
  if (!size) throw new LogicError(`Unknown date unit "${String(unit)}".`)
  return Math.trunc(ms / size)
}

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

export const STANDARD_OPERATORS: Ops = {
  // Accessing data
  var: { compile: compileVar },
  missing: { compile: compileMissing },
  missing_some: { compile: compileMissingSome },
  // Logic
  if: { compile: compileIf },
  '?:': { compile: compileIf },
  // eslint-disable-next-line eqeqeq
  '==': { fn: (a, b) => a == b },
  '===': { fn: (a, b) => a === b },
  // eslint-disable-next-line eqeqeq
  '!=': { fn: (a, b) => a != b },
  '!==': { fn: (a, b) => a !== b },
  '!': { fn: (a) => !truthy(a) },
  '!!': { fn: (a) => truthy(a) },
  or: { compile: compileOr },
  and: { compile: compileAnd },
  // Comparison
  '>': { fn: (a, b) => (a as number) > (b as number) },
  '>=': { fn: (a, b) => (a as number) >= (b as number) },
  '<': {
    fn: (a, b, c) =>
      c === undefined
        ? (a as number) < (b as number)
        : (a as number) < (b as number) && (b as number) < (c as number),
  },
  '<=': {
    fn: (a, b, c) =>
      c === undefined
        ? (a as number) <= (b as number)
        : (a as number) <= (b as number) && (b as number) <= (c as number),
  },
  // Arithmetic
  max: {
    fn: (...values) =>
      values.length ? Math.max(...values.map(toNumber)) : undefined,
  },
  min: {
    fn: (...values) =>
      values.length ? Math.min(...values.map(toNumber)) : undefined,
  },
  '+': {
    fn: (...values) =>
      values.reduce((sum: number, value) => sum + toNumber(value), 0),
  },
  '*': {
    fn: (...values) =>
      values.reduce((product: number, value) => product * toNumber(value), 1),
  },
  '-': {
    fn: (a, b) => (b === undefined ? -toNumber(a) : toNumber(a) - toNumber(b)),
  },
  '/': { fn: (a, b) => toNumber(a) / toNumber(b) },
  '%': { fn: (a, b) => toNumber(a) % toNumber(b) },
  // Arrays
  map: { compile: compileMap },
  filter: { compile: compileFilter },
  reduce: { compile: compileReduce },
  all: { compile: compileAll },
  none: { compile: compileNone },
  some: { compile: compileSome },
  merge: {
    fn: (...values) =>
      values.reduce(
        (out: unknown[], value) => out.concat(isArray(value) ? value : [value]),
        [],
      ),
  },
  in: {
    fn: (a, b) =>
      b !== null &&
      b !== undefined &&
      typeof (b as { indexOf?: unknown }).indexOf === 'function'
        ? (b as unknown[]).indexOf(a as never) !== -1
        : false,
  },
  // Strings
  cat: {
    fn: (...values) =>
      values.reduce(
        (out: string, value) =>
          out + (value === null || value === undefined ? '' : String(value)),
        '',
      ),
  },
  substr: {
    fn: (source, start, length) => {
      const text = String(source ?? '')
      const from = toNumber(start) || 0
      const begin = from < 0 ? Math.max(text.length + from, 0) : from
      if (length === undefined || length === null) return text.slice(begin)
      const n = toNumber(length)
      return n < 0
        ? text.slice(begin, Math.max(text.length + n, begin))
        : text.slice(begin, begin + n)
    },
  },
  log: { fn: (value) => value, pure: false },
}

export const EXTENDED_OPERATORS: Ops = {
  // Literals and parameters
  preserve: { compile: (_args, _c, raw) => constantNode(raw) },
  /** Placeholder for a query parameter; bound with `bindParams` before execution, null otherwise. */
  param: { compile: () => constantNode(null) },
  // Data access
  val: {
    compile: (args, c) =>
      compileVar([args.length === 1 && isArray(args[0]) ? args[0] : args], c),
  },
  exists: {
    compile: (args, c) => {
      const node = compileVar(
        [args.length === 1 && isArray(args[0]) ? args[0] : args],
        c,
      )
      return (data) => node(data) !== null
    },
  },
  get: {
    fn: (source, path, fallback) => {
      const value = readPath(source, splitPath(path))
      return value === undefined || value === null ? (fallback ?? null) : value
    },
  },
  '??': { compile: compileCoalesce },
  // Error handling
  try: { compile: compileTry },
  throw: {
    fn: (message) => {
      throw new LogicError(String(message ?? 'Rule failed.'))
    },
    pure: false,
  },
  // Type casts
  number: {
    fn: (value) => {
      const n = toNumber(value)
      return Number.isFinite(n) ? n : null
    },
  },
  string: {
    fn: (value) =>
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value),
  },
  boolean: { fn: (value) => truthy(value) },
  // Strings
  lower: { fn: (value) => String(value ?? '').toLowerCase() },
  upper: { fn: (value) => String(value ?? '').toUpperCase() },
  trim: { fn: (value) => String(value ?? '').trim() },
  length: {
    fn: (value) =>
      typeof value === 'string' || isArray(value)
        ? value.length
        : value && typeof value === 'object'
          ? Object.keys(value).length
          : 0,
  },
  starts_with: {
    fn: (value, prefix) => String(value ?? '').startsWith(String(prefix ?? '')),
  },
  ends_with: {
    fn: (value, suffix) => String(value ?? '').endsWith(String(suffix ?? '')),
  },
  contains: {
    fn: (haystack, needle) =>
      isArray(haystack)
        ? haystack.includes(needle)
        : String(haystack ?? '')
            .toLowerCase()
            .includes(String(needle ?? '').toLowerCase()),
  },
  split: {
    fn: (value, separator) =>
      String(value ?? '').split(String(separator ?? ',')),
  },
  join: {
    fn: (list, separator) =>
      isArray(list)
        ? list.join(separator === undefined ? ', ' : String(separator))
        : String(list ?? ''),
  },
  replace: {
    fn: (value, find, replacement) =>
      String(value ?? '')
        .split(String(find ?? ''))
        .join(String(replacement ?? '')),
  },
  pad_start: {
    fn: (value, size, fill) =>
      String(value ?? '').padStart(
        Math.min(toNumber(size) || 0, 1000),
        String(fill ?? ' '),
      ),
  },
  // Numbers
  round: {
    fn: (value, digits) => {
      const factor = 10 ** Math.min(Math.max(toNumber(digits) || 0, 0), 15)
      return Math.round(toNumber(value) * factor) / factor
    },
  },
  floor: { fn: (value) => Math.floor(toNumber(value)) },
  ceil: { fn: (value) => Math.ceil(toNumber(value)) },
  abs: { fn: (value) => Math.abs(toNumber(value)) },
  clamp: {
    fn: (value, low, high) =>
      Math.min(Math.max(toNumber(value), toNumber(low)), toNumber(high)),
  },
  // Arrays
  find: { compile: compileFind },
  count_if: { compile: compileCountIf },
  sum_by: { compile: compileSumBy },
  sort_by: { compile: compileSortBy },
  count: { fn: (list) => (isArray(list) ? list.length : 0) },
  sum: {
    fn: (list) =>
      isArray(list)
        ? list.reduce((sum: number, value) => sum + (toNumber(value) || 0), 0)
        : 0,
  },
  avg: {
    fn: (list) =>
      isArray(list) && list.length
        ? list.reduce((sum: number, value) => sum + (toNumber(value) || 0), 0) /
          list.length
        : null,
  },
  unique: { fn: (list) => (isArray(list) ? [...new Set(list)] : []) },
  pluck: {
    fn: (list, path) => {
      const keys = splitPath(path)
      return isArray(list)
        ? list.map((item) => readPath(item, keys) ?? null)
        : []
    },
  },
  slice: {
    fn: (value, start, end) =>
      isArray(value) || typeof value === 'string'
        ? value.slice(
            toNumber(start) || 0,
            end === undefined || end === null ? undefined : toNumber(end),
          )
        : null,
  },
  first: { fn: (list) => (isArray(list) ? (list[0] ?? null) : null) },
  last: {
    fn: (list) => (isArray(list) ? (list[list.length - 1] ?? null) : null),
  },
  // Objects
  object: { compile: compileObject },
  keys: {
    fn: (value) =>
      value && typeof value === 'object' ? Object.keys(value) : [],
  },
  values: {
    fn: (value) =>
      value && typeof value === 'object' ? Object.values(value) : [],
  },
  pick: {
    fn: (value, keys) => {
      const out: Record<string, unknown> = {}
      for (const key of argsOf(keys)) {
        const name = safeKey(key)
        const found = readKey(value, name)
        if (found !== undefined) out[name] = found
      }
      return out
    },
  },
  // Dates
  now: { fn: () => new Date().toISOString(), pure: false },
  today: { fn: () => new Date().toISOString().slice(0, 10), pure: false },
  date_add: { fn: addToDate },
  date_diff: { fn: diffDates },
  date: { fn: (value) => toDate(value).toISOString() },
}
