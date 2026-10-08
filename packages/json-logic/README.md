# @spsedu360/json-logic

A compiled, CSP-safe [JSON Logic](https://jsonlogic.com) engine plus a framed-query executor, shared by the web builder (studio and published apps) and `web-builder-service`.

* **Fast.** Each rule is compiled once into a tree of closures, with operators resolved at compile time and constant sub-expressions folded. Rules are cached by identity (WeakMap) and by text (LRU). The engine is 6–9× faster than `json-logic-js` on typical UI rules (`npm run bench`):

  | Rule | json-logic-js | this engine | Speed-up |
  |---|---|---|---|
  | visibility (`and` of comparisons) | 1016 ns | 146 ns | 7.0× |
  | row filter (`in` + comparisons) | 1320 ns | 140 ns | 9.4× |
  | computed total (`reduce`) | | | 6.0× |
  | nested conditions | | | 8.9× |

* **Safe.** It never uses `eval` or `new Function`, so it works under a strict CSP. `__proto__`, `constructor` and `prototype` can't be read. Nesting depth is limited, and rules with loops get an iteration budget; loop-free rules skip the budget check.
* **Conformant.** It passes the official 278-case test suite from jsonlogic.com (`npm test`).
* **Analyzable.** `analyze(rule)` returns the data paths a rule reads, so UIs re-evaluate a binding only when its inputs change. It also reports `dynamic: true` when a path is computed at runtime.

## Usage

```ts
import { logic, createEngine } from '@spsedu360/json-logic'

const visible = logic.compile({ '==': [{ var: 'fields.type' }, 'business'] })
visible({ fields: { type: 'business' } }) // true

logic.analyze({ '*': [{ var: 'fields.qty' }, { var: 'fields.price' }] })
// { paths: ['fields.qty', 'fields.price'], dynamic: false }

const engine = createEngine({ maxDepth: 64, maxIterations: 1_000_000 })
engine.addOperator('vat', { fn: (amount) => Number(amount) * 0.2, pure: true })
```

`validate(rule)` returns `{ ok, error }` without running the rule. Runtime errors are thrown as `LogicError`, which carries the path of the failing node.

## Operators

**Standard:** `var`, `missing`, `missing_some`, `if`/`?:`, `==`, `===`, `!=`, `!==`, `!`, `!!`, `or`, `and`, `>`, `>=`, `<`, `<=` (including the three-argument "between" form), `max`, `min`, `+`, `-`, `*`, `/`, `%`, `map`, `filter`, `reduce`, `all`, `some`, `none`, `merge`, `in`, `cat`, `substr`, `log`.

**Extended:**

| Area | Operators |
|---|---|
| Data and control | `preserve`, `param`, `val`, `exists`, `get`, `??`, `try`, `throw` |
| Casts | `number`, `string`, `boolean` |
| Text | `lower`, `upper`, `trim`, `length`, `starts_with`, `ends_with`, `contains`, `split`, `join`, `replace`, `pad_start` |
| Numbers | `round`, `floor`, `ceil`, `abs`, `clamp` |
| Lists | `find`, `count_if`, `sum_by`, `sort_by`, `count`, `sum`, `avg`, `unique`, `pluck`, `slice`, `first`, `last` |
| Objects | `object`, `keys`, `values`, `pick` |
| Dates | `now`, `today`, `date`, `date_add`, `date_diff` |

## Framed queries

The builder never asks people to write queries. A source is shaped by a **frame**, which is applied with `runQuery(rows, query, engine, params)`. A frame has these parts:

* `filter`: a JSON Logic predicate.
* `search`: a term and the fields to search.
* `sort`: up to five keys.
* `offset` and `limit`.
* `select`: the fields to keep.
* `transform`: a JSON Logic rule that reshapes each row.

Values from the page are referenced as `{"param": "fields.city"}` and bound as **literals**. An object or array value is wrapped in `preserve`, so a value is never read as logic. `normalizeQuery` validates a frame and enforces `QUERY_LIMITS`.

Condition groups from the no-code editor are converted with `groupToLogic`. `exprToRule` converts any builder expression (condition group, `{{template}}` text or raw rule) to JSON Logic. The studio, the published app and the service all use this same function.

## Scripts

* `npm run build` — compiles to `dist/` (CommonJS + types; used by the NestJS service).
* `npm test` — runs the conformance and unit tests.
* `npm run bench` — runs the comparison with `json-logic-js`.
