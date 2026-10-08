/**
 * Compiled JSON Logic engine.
 *
 * Rules are plain JSON (https://jsonlogic.com) so they can be stored with a project, edited
 * visually and executed identically in the browser and on the server. The engine compiles a
 * rule once into a tree of closures:
 *
 *  - operator dispatch is resolved at compile time (no string lookups while evaluating),
 *  - `var` paths are pre-split, with a dedicated fast path for single keys,
 *  - pure operators whose arguments are all constants are folded at compile time,
 *  - `and` / `or` / `if` short-circuit,
 *  - compiled rules are cached by object identity (WeakMap) and by JSON text (LRU).
 *
 * No code is generated (`eval` / `new Function` are never used), so the engine is safe under a
 * strict Content Security Policy and rules cannot execute arbitrary code. Property access is
 * limited to own properties and blocks prototype keys. Iterations are bounded by a per-evaluation
 * budget so a rule cannot hang the UI.
 */

export type Rule = unknown
export type Evaluator = (data?: unknown) => unknown

/** A compiled node. `k` marks a compile-time constant and `v` holds its value. */
interface Node {
  (data: unknown): unknown
  k?: true
  v?: unknown
}

export interface OperatorDefinition {
  /** Called with evaluated arguments. */
  fn?: (...args: unknown[]) => unknown
  /**
   * Full control over compilation (lazy evaluation, scoping). Receives the raw arguments and a
   * compiler for sub-rules.
   */
  compile?: (args: Rule[], compiler: Compiler, raw: Rule) => Node
  /** Deterministic and side-effect free; enables constant folding. Defaults to true. */
  pure?: boolean
}

export interface EngineOptions {
  /** Maximum nesting depth of a rule. */
  maxDepth?: number
  /** Maximum array iterations per evaluation (map/filter/reduce/all/some/none/sort/...). */
  maxIterations?: number
  /** Extra or overriding operators. */
  operators?: Record<string, OperatorDefinition>
}

export class LogicError extends Error {
  constructor(
    message: string,
    /** JSON-pointer-like path to the failing node, e.g. `/and/1/==/0`. */
    readonly path = '',
  ) {
    super(path ? `${message} (at ${path})` : message)
    this.name = 'LogicError'
  }
}

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])

/** JSON Logic truthiness: empty arrays are false, the string "0" is true. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value) && value.length === 0) return false
  return !!value
}

/** Own-property read that never reaches the prototype chain. */
export function readKey(source: unknown, key: string | number): unknown {
  if (source === null || source === undefined) return undefined
  if (typeof source === 'string') {
    if (key === 'length') return source.length
    const index = typeof key === 'number' ? key : Number(key)
    return Number.isInteger(index) ? source[index] : undefined
  }
  if (typeof source !== 'object') return undefined
  const name = String(key)
  if (FORBIDDEN.has(name)) return undefined
  if (Object.prototype.hasOwnProperty.call(source, name))
    return (source as Record<string, unknown>)[name]
  if (name === 'length' && Array.isArray(source)) return source.length
  return undefined
}

export function readPath(
  source: unknown,
  keys: readonly (string | number)[],
): unknown {
  let current = source
  for (let index = 0; index < keys.length; index++) {
    if (current === null || current === undefined) return undefined
    current = readKey(current, keys[index])
  }
  return current
}

export function splitPath(path: unknown): (string | number)[] {
  if (Array.isArray(path))
    return path.map((part) => (typeof part === 'number' ? part : String(part)))
  if (typeof path === 'number') return [path]
  const text = String(path ?? '')
  return text === '' ? [] : text.split('.')
}

const constant = (value: unknown): Node => {
  const node = (() => value) as Node
  node.k = true
  node.v = value
  return node
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Compiles sub-rules on behalf of operators; tracks depth and path for error messages. */
export class Compiler {
  constructor(
    private readonly engine: LogicEngine,
    readonly depth: number,
    readonly path: string,
  ) {}

  /** Compiles a child rule at `segment`. */
  child(rule: Rule, segment: string | number): Node {
    return this.engine.compileNode(
      rule,
      this.depth + 1,
      `${this.path}/${segment}`,
    )
  }

  /** Runs `body` once per element with a fresh iteration budget check. */
  tick(count: number): void {
    this.engine.consume(count, this.path)
  }

  fail(message: string): never {
    throw new LogicError(message, this.path)
  }
}

/** Normalises operator arguments: a non-array argument is treated as a single-element list. */
export function argsOf(value: unknown): Rule[] {
  return Array.isArray(value) ? value : [value]
}

export class LogicEngine {
  private readonly operators = new Map<string, OperatorDefinition>()
  private readonly byObject = new WeakMap<object, Evaluator>()
  private readonly byText = new Map<string, Evaluator>()
  private readonly maxDepth: number
  private readonly maxIterations: number
  private remaining = Infinity
  /** Set while compiling when the rule contains a loop, so only those pay for budget tracking. */
  private loops = false

  constructor(
    options: EngineOptions = {},
    base: Record<string, OperatorDefinition> = {},
  ) {
    this.maxDepth = options.maxDepth ?? 64
    this.maxIterations = options.maxIterations ?? 1_000_000
    for (const [name, definition] of Object.entries(base))
      this.operators.set(name, definition)
    for (const [name, definition] of Object.entries(options.operators ?? {}))
      this.operators.set(name, definition)
  }

  addOperator(name: string, definition: OperatorDefinition): this {
    if (FORBIDDEN.has(name))
      throw new LogicError(`"${name}" cannot be used as an operator name.`)
    this.operators.set(name, definition)
    this.byText.clear()
    return this
  }

  hasOperator(name: string): boolean {
    return this.operators.has(name)
  }

  operatorNames(): string[] {
    return [...this.operators.keys()].sort()
  }

  /** Compiles a rule (cached). Throws LogicError for unknown operators or rules nested too deep. */
  compile(rule: Rule): Evaluator {
    if (isPlainObject(rule) || Array.isArray(rule)) {
      const cached = this.byObject.get(rule)
      if (cached) return cached
      const evaluator = this.build(rule)
      this.byObject.set(rule, evaluator)
      return evaluator
    }
    return this.build(rule)
  }

  private build(rule: Rule): Evaluator {
    this.loops = false
    const node = this.compileNode(rule, 0, '')
    return this.wrap(node, this.loops)
  }

  /** Compiles a rule given as JSON text, with an LRU cache keyed by the text. */
  compileText(json: string): Evaluator {
    const cached = this.byText.get(json)
    if (cached) {
      this.byText.delete(json)
      this.byText.set(json, cached)
      return cached
    }
    let rule: Rule
    try {
      rule = JSON.parse(json)
    } catch {
      throw new LogicError('Rule is not valid JSON.')
    }
    const evaluator = this.build(rule)
    this.byText.set(json, evaluator)
    if (this.byText.size > 500)
      this.byText.delete(this.byText.keys().next().value as string)
    return evaluator
  }

  evaluate(rule: Rule, data?: unknown): unknown {
    return this.compile(rule)(data)
  }

  /** Returns `{ ok: true }` or the first compile error with its location. */
  validate(
    rule: Rule,
  ): { ok: true } | { ok: false; error: string; path: string } {
    try {
      this.compileNode(rule, 0, '')
      return { ok: true }
    } catch (error) {
      if (error instanceof LogicError)
        return { ok: false, error: error.message, path: error.path }
      return { ok: false, error: String(error), path: '' }
    }
  }

  /**
   * Static data dependencies of a rule: the `var`/`val` paths it reads from the root data
   * (paths read from inside map/filter/... iterations are excluded). Used to re-run queries
   * only when the data they depend on changes.
   */
  dependencies(rule: Rule): string[] {
    return this.analyze(rule).paths
  }

  /**
   * Like `dependencies`, and also reports whether the rule reads data through computed paths
   * (then callers must treat the whole data object as a dependency).
   */
  analyze(rule: Rule): { paths: string[]; dynamic: boolean } {
    let dynamic = false
    const found = new Set<string>()
    const visit = (node: Rule, scoped: boolean): void => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item, scoped)
        return
      }
      if (!isPlainObject(node)) return
      const keys = Object.keys(node)
      if (keys.length !== 1) return
      const op = keys[0]
      const args = argsOf(node[op])
      if (op === 'var' || op === 'val' || op === 'exists') {
        const path = op === 'var' ? args[0] : op === 'exists' ? args : args
        if (!scoped && (typeof path === 'string' || typeof path === 'number'))
          found.add(String(path))
        else if (
          !scoped &&
          Array.isArray(path) &&
          path.every(
            (part) => typeof part === 'string' || typeof part === 'number',
          )
        )
          found.add(path.join('.'))
        else {
          if (!scoped && path !== undefined) dynamic = true
          visit(path, scoped)
        }
        if (op === 'var') visit(args.slice(1), scoped)
        return
      }
      if (op === 'missing' || op === 'missing_some') {
        const keysArg = op === 'missing' ? args : args[1]
        for (const key of argsOf(keysArg))
          if (!scoped && typeof key === 'string') found.add(key)
        return
      }
      if (ITERATORS.has(op)) {
        visit(args[0], scoped)
        for (const inner of args.slice(1)) visit(inner, true)
        return
      }
      visit(args, scoped)
    }
    visit(rule, false)
    return { paths: [...found], dynamic }
  }

  /** @internal */
  consume(count: number, path: string): void {
    this.remaining -= count
    if (this.remaining < 0)
      throw new LogicError(
        `Rule exceeded the limit of ${this.maxIterations} iterations.`,
        path,
      )
  }

  private wrap(node: Node, loops: boolean): Evaluator {
    if (node.k) {
      const value = node.v
      return () => value
    }
    if (!loops) return (data?: unknown) => node(data ?? null)
    return (data?: unknown) => {
      const saved = this.remaining
      this.remaining = this.maxIterations
      try {
        return node(data ?? null)
      } finally {
        this.remaining = saved
      }
    }
  }

  /** @internal */
  compileNode(rule: Rule, depth: number, path: string): Node {
    if (depth > this.maxDepth)
      throw new LogicError(
        `Rule is nested deeper than ${this.maxDepth} levels.`,
        path,
      )
    if (Array.isArray(rule)) {
      const items = rule.map((item, index) =>
        this.compileNode(item, depth + 1, `${path}/${index}`),
      )
      if (items.every((item) => item.k))
        return constant(items.map((item) => item.v))
      const count = items.length
      return (data) => {
        const out = new Array(count)
        for (let index = 0; index < count; index++)
          out[index] = items[index](data)
        return out
      }
    }
    if (!isPlainObject(rule)) return constant(rule)
    const keys = Object.keys(rule)
    if (keys.length !== 1) return constant(rule)
    const op = keys[0]
    const definition = this.operators.get(op)
    if (!definition) throw new LogicError(`Unknown operator "${op}".`, path)
    if (ITERATORS.has(op) || op === 'sort_by') this.loops = true
    const compiler = new Compiler(this, depth, `${path}/${op}`)
    const raw = rule[op]
    if (definition.compile) {
      return definition.compile(argsOf(raw), compiler, raw)
    }
    const fn = definition.fn!
    const args = argsOf(raw).map((arg, index) => compiler.child(arg, index))
    const pure = definition.pure !== false
    if (pure && args.every((arg) => arg.k)) {
      try {
        return constant(fn(...args.map((arg) => arg.v)))
      } catch {
        // Leave errors to evaluation time so `try` can handle them.
      }
    }
    switch (args.length) {
      case 0:
        return () => fn()
      case 1: {
        const [a] = args
        return (data) => fn(a(data))
      }
      case 2: {
        const [a, b] = args
        return (data) => fn(a(data), b(data))
      }
      case 3: {
        const [a, b, c] = args
        return (data) => fn(a(data), b(data), c(data))
      }
      default:
        return (data) => fn(...args.map((arg) => arg(data)))
    }
  }
}

const ITERATORS = new Set([
  'map',
  'filter',
  'reduce',
  'all',
  'some',
  'none',
  'find',
  'sort_by',
  'count_if',
  'sum_by',
])

export { constant as constantNode }
export type { Node as LogicNode }
