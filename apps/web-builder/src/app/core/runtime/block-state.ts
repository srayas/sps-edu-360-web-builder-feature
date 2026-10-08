import { Signal, computed } from '@angular/core'
import { truthy } from '@spsedu360/json-logic'
import {
  Block,
  Props,
  Scope,
  definition,
  evaluateExpr,
  isFormField,
  toChoices,
} from '../model'
import { narrowed } from './narrow'
import { SiteRuntime } from './site-runtime'

export interface Choice {
  label: string
  value: string
}

export interface BlockState {
  /** Block with computed properties applied (same object when nothing is computed). */
  block: Block
  visible: boolean
  enabled: boolean
  /** Computed field value, when the block has a value binding. */
  value?: { value: unknown }
  /** Computed options for choice fields, or null to use the block's own items/source. */
  options: Choice[] | null
}

interface Evaluated {
  visible?: boolean
  enabled?: boolean
  required?: boolean
  value?: { value: unknown }
  options?: Choice[]
  props?: Record<string, unknown>
}

const NOTHING: Evaluated = {}

/**
 * Resolves a block's effective state from its own bindings, the page rules and its container's
 * enabled state. Bindings are re-evaluated only when the scope paths they read change.
 */
export function blockState(
  runtime: SiteRuntime,
  block: Signal<Block>,
  scope: Signal<Scope>,
  parentDisabled: Signal<boolean>,
): Signal<BlockState> {
  const deps = computed(() => SiteRuntime.logicPaths(block().logic))
  const hasLogic = computed(() => {
    const logic = block().logic
    return !!(
      logic.visible ||
      logic.enabled ||
      logic.required ||
      logic.value ||
      logic.options ||
      (logic.props && Object.keys(logic.props).length)
    )
  })
  const evaluated = narrowed(
    scope,
    deps,
    (value): Evaluated => {
      if (!hasLogic()) return NOTHING
      const logic = block().logic
      const out: Evaluated = {}
      if (logic.visible)
        out.visible = truthy(evaluateExpr(logic.visible, value, true))
      if (logic.enabled)
        out.enabled = truthy(evaluateExpr(logic.enabled, value, true))
      if (logic.required)
        out.required = truthy(evaluateExpr(logic.required, value, false))
      if (logic.value)
        out.value = { value: evaluateExpr(logic.value, value, null) }
      if (logic.options)
        out.options = toChoices(evaluateExpr(logic.options, value, []))
      if (logic.props) {
        out.props = {}
        for (const [key, expr] of Object.entries(logic.props))
          out.props[key] = evaluateExpr(expr, value, block().props[key])
      }
      return out
    },
    () => block().logic,
  )
  const overlay = computed(() => runtime.overlays().get(block().id))

  return computed<BlockState>(() => {
    const source = block()
    const own = evaluated()
    const rules = overlay()
    const visible =
      runtime.isVisible(source) && (rules?.visible ?? own.visible ?? true)
    const enabled = !parentDisabled() && (rules?.enabled ?? own.enabled ?? true)
    const required = rules?.required ?? own.required
    const computedProps = own.props || rules?.props
    const keys = new Set(
      definition(source.type)?.props.map((prop) => prop.key) ?? [],
    )
    let effective = source
    if (computedProps || !enabled || required !== undefined) {
      const props: Props = { ...source.props }
      for (const [key, value] of Object.entries({
        ...own.props,
        ...rules?.props,
      })) {
        if (!keys.has(key)) continue
        const fallback = source.props[key]
        props[key] =
          typeof fallback === 'boolean'
            ? truthy(value)
            : typeof fallback === 'number'
              ? Number(value) || 0
              : value === null || value === undefined
                ? ''
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)
      }
      if (!enabled && keys.has('disabled')) props['disabled'] = true
      if (required !== undefined && keys.has('required'))
        props['required'] = required
      effective = { ...source, props }
    }
    return {
      block: effective,
      visible,
      enabled,
      value: isFormField(source.type) ? own.value : undefined,
      options: own.options ?? null,
    }
  })
}
