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
import type { Block, Expr } from './types'

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
