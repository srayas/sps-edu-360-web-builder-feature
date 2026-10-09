/**
 * UI logic: converts builder expressions to JSON Logic and evaluates them with the shared compiled
 * engine. Conversions are cached so a binding is converted and compiled once, then only
 * re-evaluated when the values it reads change.
 */
import {
  Evaluator,
  Rule,
  exprToRule as toRule,
  logic,
  LogicError,
} from '@spsedu360/json-logic'
import { fieldKey } from './expressions'
import { isFormField } from './registry'
import type { Block, ExecutionParam, Expr, LogicFunction } from './types'

export { logic }
export { templateToRule } from '@spsedu360/json-logic'

export const exprToRule = (expr: Expr): Rule => toRule(expr)

const ruleCache = new Map<
  string,
  { rule: Rule; evaluator: Evaluator; paths: string[]; dynamic: boolean }
>()

/** Compiles an expression (cached by its JSON text). Throws LogicError when it is invalid. */
export function compileExpr(expr: Expr) {
  const key = JSON.stringify(expr)
  let entry = ruleCache.get(key)
  if (!entry) {
    const rule = exprToRule(expr)
    const evaluator = logic.compile(rule)
    const { paths, dynamic } = logic.analyze(rule)
    entry = { rule, evaluator, paths, dynamic }
    ruleCache.set(key, entry)
    if (ruleCache.size > 2000)
      ruleCache.delete(ruleCache.keys().next().value as string)
  }
  return entry
}

/** Evaluates an expression; returns `fallback` if it is missing or fails. */
export function evaluateExpr(
  expr: Expr | undefined,
  scope: unknown,
  fallback: unknown = null,
): unknown {
  if (!expr) return fallback
  try {
    return compileExpr(expr).evaluator(scope)
  } catch {
    return fallback
  }
}

/** Empty expressions (no conditions, blank template) count as "not set". */
export function isEmptyExpr(expr: Expr | undefined): boolean {
  if (!expr) return true
  if (expr.kind === 'conditions') return expr.group.conditions.length === 0
  if (expr.kind === 'template') return expr.text.trim() === ''
  return expr.rule === null || expr.rule === undefined || expr.rule === ''
}

export function validateExpr(expr: Expr): string {
  try {
    const result = logic.validate(exprToRule(expr))
    return result.ok ? '' : result.error
  } catch (error) {
    return error instanceof LogicError ? error.message : String(error)
  }
}

/** Scope paths an expression reads (for dependency tracking and cycle checks). */
export function exprPaths(expr: Expr | undefined): string[] {
  if (!expr) return []
  try {
    return compileExpr(expr).paths
  } catch {
    return []
  }
}

/** The key under which a form field publishes its value in `fields.*`. */
export function fieldName(block: Block): string {
  return String(
    block.props['field'] ||
      fieldKey(String(block.props['label'] || block.name)),
  )
}

export function isFieldBlock(block: Block): boolean {
  return isFormField(block.type)
}

/** Converts an options expression result into `{label, value}` choices. */
export function toChoices(value: unknown): { label: string; value: string }[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 1000).map((item) => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      const label =
        record['label'] ??
        record['name'] ??
        record['title'] ??
        record['value'] ??
        ''
      const raw = record['value'] ?? record['id'] ?? label
      return { label: String(label), value: String(raw) }
    }
    return { label: String(item ?? ''), value: String(item ?? '') }
  })
}

/**
 * Finds computed-value cycles between fields on a page (A's value reads B, B's reads A).
 * Returns the field names involved in each cycle.
 */
export function findValueCycles(
  fields: { name: string; reads: string[] }[],
): string[][] {
  const graph = new Map(
    fields.map((field) => [
      field.name,
      field.reads
        .filter((path) => path.startsWith('fields.'))
        .map((path) => path.split('.')[1]),
    ]),
  )
  const cycles: string[][] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const visit = (name: string): void => {
    if (state.get(name) === 'done') return
    if (state.get(name) === 'visiting') {
      cycles.push(stack.slice(stack.indexOf(name)).concat(name))
      return
    }
    state.set(name, 'visiting')
    stack.push(name)
    for (const next of graph.get(name) ?? []) if (graph.has(next)) visit(next)
    stack.pop()
    state.set(name, 'done')
  }
  for (const name of graph.keys()) visit(name)
  return cycles
}

// ---------------------------------------------------------------------------------------------
// Functions: {"fn": ["name", …args]} calls a project function. Bodies are compiled once when the
// project's functions change; results are memoized per argument list (functions are pure).
// ---------------------------------------------------------------------------------------------

interface RegisteredFunction {
  params: ExecutionParam[]
  evaluate: Evaluator
}

const functions = new Map<string, RegisteredFunction>()
const memo = new Map<string, unknown>()
const MEMO_LIMIT = 2000
let callDepth = 0
let functionsKey = ''

export const FUNCTION_NAME = /^[a-zA-Z_][\w]{0,40}$/

/** Parses a parameter default: numbers, booleans, null and JSON stay typed, the rest is text. */
export function parseParamValue(text: string | undefined): unknown {
  if (text === undefined) return null
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
  if (trimmed === 'null') return null
  if (/^[[{"]/.test(trimmed)) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return text
    }
  }
  return text
}

/** Installs the project's functions (no-op when they did not change). Returns true if they changed. */
export function setFunctions(
  list: readonly LogicFunction[] | undefined,
): boolean {
  const key = JSON.stringify(list ?? [])
  if (key === functionsKey) return false
  functionsKey = key
  functions.clear()
  memo.clear()
  for (const fn of list ?? []) {
    if (!FUNCTION_NAME.test(fn.name)) continue
    try {
      functions.set(fn.name, {
        params: fn.params,
        evaluate: compileExpr(fn.body).evaluator,
      })
    } catch {
      /* invalid bodies are reported in the studio; calls fail with an unknown-function error */
    }
  }
  return true
}

export function functionNames(): string[] {
  return [...functions.keys()]
}

/** Calls a project function with positional arguments. */
export function callFunction(name: string, args: unknown[]): unknown {
  const fn = functions.get(name)
  if (!fn) throw new LogicError(`Unknown function "${name}".`)
  let key = ''
  try {
    key = name + '\u0000' + JSON.stringify(args)
  } catch {
    key = ''
  }
  if (key && key.length < 4000 && memo.has(key)) return memo.get(key)
  if (callDepth >= 32)
    throw new LogicError('Functions call each other too deeply.')
  const scope: Record<string, unknown> = { args }
  fn.params.forEach((param, index) => {
    scope[param.name] =
      args[index] !== undefined && args[index] !== null
        ? args[index]
        : parseParamValue(param.defaultValue)
  })
  callDepth++
  let result: unknown
  try {
    result = fn.evaluate(scope)
  } finally {
    callDepth--
  }
  if (key && key.length < 4000) {
    if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value as string)
    memo.set(key, result)
  }
  return result
}

logic.addOperator('fn', {
  fn: (name: unknown, ...args: unknown[]) => callFunction(String(name), args),
  pure: false,
})

/** `{"fn": [name, …]}` call shape (used by the studio's function picker). */
export function functionCall(
  rule: unknown,
): { name: string; args: unknown[] } | null {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null
  const keys = Object.keys(rule)
  if (keys.length !== 1 || keys[0] !== 'fn') return null
  const args = (rule as Record<string, unknown>)['fn']
  if (!Array.isArray(args) || typeof args[0] !== 'string') return null
  return { name: args[0], args: args.slice(1) }
}
