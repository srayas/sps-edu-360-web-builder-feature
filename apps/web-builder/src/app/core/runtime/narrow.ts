import { Signal, computed, untracked } from '@angular/core'
import { readPath } from '@spsedu360/json-logic'

const sameValues = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

/**
 * Re-evaluates `fn` only when one of `paths` changes inside `scope` (instead of whenever any part
 * of the scope changes). With `dynamic`, the whole scope is the dependency.
 *
 * This is what keeps logic-heavy pages fast: typing in one field only re-evaluates the bindings
 * that read that field. `key` adds extra dependencies compared by identity (e.g. the rule
 * definition itself, or a list of them).
 */
export function narrowed<T>(
  scope: Signal<unknown>,
  paths: () => { paths: string[]; dynamic: boolean },
  fn: (scope: unknown) => T,
  key: () => unknown = () => null,
): Signal<T> {
  const inputs = computed(
    () => {
      const { paths: list, dynamic } = paths()
      const value = scope()
      const extra = key()
      const extras = Array.isArray(extra) ? extra : [extra]
      if (dynamic) return [...extras, value]
      return [
        ...extras,
        ...list.map((path) => readPath(value, path.split('.'))),
      ]
    },
    { equal: sameValues },
  )
  return computed(() => {
    inputs()
    return untracked(() => fn(scope()))
  })
}
