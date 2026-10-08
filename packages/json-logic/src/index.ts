/*
 * @spsedu360/json-logic — compiled, CSP-safe JSON Logic engine shared by the web builder and the
 * web-builder service. See README.md for the operator reference.
 */
import { EngineOptions, LogicEngine } from './engine'
import { EXTENDED_OPERATORS, STANDARD_OPERATORS } from './operators'

export * from './engine'
export {
  STANDARD_OPERATORS,
  EXTENDED_OPERATORS,
  compareValues,
} from './operators'
export * from './query'
export * from './expr'

/** Creates an engine with the standard and extended operator sets. */
export function createEngine(options: EngineOptions = {}): LogicEngine {
  return new LogicEngine(options, {
    ...STANDARD_OPERATORS,
    ...EXTENDED_OPERATORS,
  })
}

/** Shared default engine (compiled rules are cached per engine). */
export const logic: LogicEngine = createEngine()
