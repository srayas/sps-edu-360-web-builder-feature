/**
 * Builder expressions: the three ways the no-code editor stores logic (condition groups, text
 * templates, raw JSON Logic). Shared so the studio, the published app and the service convert
 * them to rules identically.
 */
import { Rule } from './engine'
import { ConditionGroup, groupToLogic } from './query'

export type Expr =
  | { kind: 'conditions'; group: ConditionGroup }
  | { kind: 'template'; text: string }
  | { kind: 'rule'; rule: Rule }

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][\w]*(?:\.[\w-]+)*)\s*\}\}/g

/** `"Hi {{fields.name}}!"` → `{"cat": ["Hi ", {"var": "fields.name"}, "!"]}`. */
export function templateToRule(text: string): Rule {
  const parts: Rule[] = []
  let last = 0
  PLACEHOLDER.lastIndex = 0
  for (
    let match = PLACEHOLDER.exec(text);
    match;
    match = PLACEHOLDER.exec(text)
  ) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ var: match[1] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  if (parts.length === 0) return ''
  // A template that is exactly one placeholder keeps the raw value (number, array, …).
  if (parts.length === 1) return parts[0]
  return { cat: parts }
}

export function exprToRule(expr: Expr): Rule {
  switch (expr.kind) {
    case 'conditions':
      return groupToLogic(expr.group)
    case 'template':
      return templateToRule(expr.text)
    case 'rule':
      return expr.rule
  }
}
