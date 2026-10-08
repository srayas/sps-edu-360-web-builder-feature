import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import cases from './fixtures/jsonlogic-tests.json'
import {
  LogicError,
  createEngine,
  logic,
  groupToLogic,
  runQuery,
  bindParams,
} from '../src/index'

test('passes the official JSON Logic conformance suite', () => {
  const failures: string[] = []
  let count = 0
  for (const entry of cases as unknown[]) {
    if (!Array.isArray(entry)) continue
    const [rule, data, expected] = entry
    count++
    let actual: unknown
    try {
      actual = logic.evaluate(rule, data)
    } catch (error) {
      actual = `threw ${(error as Error).message}`
    }
    try {
      assert.deepStrictEqual(actual, expected)
    } catch {
      failures.push(
        `${JSON.stringify(rule)} with ${JSON.stringify(data)} → ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
      )
    }
  }
  assert.ok(count > 250, 'fixture loaded')
  assert.deepStrictEqual(failures, [])
})

test('compiles once and caches by rule identity', () => {
  const rule = { '==': [{ var: 'a' }, 1] }
  assert.equal(logic.compile(rule), logic.compile(rule))
  assert.equal(
    logic.compileText('{"var":"x"}'),
    logic.compileText('{"var":"x"}'),
  )
  assert.equal(logic.evaluate(rule, { a: 1 }), true)
})

test('folds constant sub-expressions at compile time', () => {
  let calls = 0
  const engine = createEngine({
    operators: {
      counted: {
        fn: (value) => {
          calls++
          return value
        },
      },
    },
  })
  const evaluate = engine.compile({ '+': [{ counted: [2] }, { var: 'n' }] })
  assert.equal(calls, 1, 'evaluated during compilation')
  assert.equal(evaluate({ n: 3 }), 5)
  assert.equal(evaluate({ n: 4 }), 6)
  assert.equal(calls, 1, 'never re-evaluated')
})

test('blocks prototype access and unknown operators', () => {
  assert.equal(logic.evaluate({ var: 'constructor' }, {}), null)
  assert.equal(logic.evaluate({ var: '__proto__' }, {}), null)
  assert.equal(logic.evaluate({ var: 'a.constructor.name' }, { a: {} }), null)
  assert.equal(logic.evaluate({ var: 'toString' }, {}), null)
  assert.throws(
    () => logic.compile({ method: ['x', 'toString'] }),
    /Unknown operator "method"/,
  )
  assert.throws(() => logic.compile({ object: [['__proto__', 1]] }), LogicError)
  const result = logic.validate({ and: [true, { nope: 1 }] })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.path, '/and/1')
})

test('limits iterations and depth', () => {
  const engine = createEngine({ maxIterations: 1000, maxDepth: 10 })
  const big = Array.from({ length: 2000 }, (_, i) => i)
  assert.throws(
    () =>
      engine.evaluate({ map: [{ var: 'list' }, { var: '' }] }, { list: big }),
    /iterations/,
  )
  let deep: unknown = 1
  for (let i = 0; i < 20; i++) deep = { '!': [deep] }
  assert.throws(() => engine.compile(deep), /nested deeper/)
  // The budget resets for each evaluation.
  const ok = engine.compile({ map: [{ var: 'list' }, 1] })
  for (let i = 0; i < 5; i++)
    assert.equal((ok({ list: big.slice(0, 900) }) as unknown[]).length, 900)
})

test('extension operators', () => {
  const data = {
    user: { name: '  Ada Lovelace ', tags: ['a', 'b', 'a'] },
    items: [
      { price: 3, qty: 2 },
      { price: 5, qty: 1 },
    ],
    when: '2026-01-31T00:00:00.000Z',
  }
  assert.equal(
    logic.evaluate({ trim: { var: 'user.name' } }, data),
    'Ada Lovelace',
  )
  assert.equal(
    logic.evaluate({ upper: { trim: { var: 'user.name' } } }, data),
    'ADA LOVELACE',
  )
  assert.deepEqual(logic.evaluate({ unique: { var: 'user.tags' } }, data), [
    'a',
    'b',
  ])
  assert.equal(
    logic.evaluate(
      {
        sum_by: [{ var: 'items' }, { '*': [{ var: 'price' }, { var: 'qty' }] }],
      },
      data,
    ),
    11,
  )
  assert.deepEqual(
    logic.evaluate(
      {
        pluck: [
          { sort_by: [{ var: 'items' }, { var: 'price' }, 'desc'] },
          'price',
        ],
      },
      data,
    ),
    [5, 3],
  )
  assert.equal(
    logic.evaluate({ '??': [{ var: 'missing' }, null, 'fallback'] }, data),
    'fallback',
  )
  assert.equal(
    logic.evaluate({ try: [{ date: 'not a date' }, 'bad'] }, data),
    'bad',
  )
  assert.equal(
    logic.evaluate({ date_add: [{ var: 'when' }, 1, 'month'] }, data),
    '2026-03-03T00:00:00.000Z',
  )
  assert.equal(
    logic.evaluate({ date_diff: ['2026-02-10', '2026-02-01', 'days'] }, {}),
    9,
  )
  assert.deepEqual(
    logic.evaluate(
      {
        object: [
          ['full', { cat: [{ var: 'a' }, '-', { var: 'b' }] }],
          ['n', 1],
        ],
      },
      { a: 'x', b: 'y' },
    ),
    { full: 'x-y', n: 1 },
  )
  assert.equal(logic.evaluate({ round: [3.14159, 2] }, {}), 3.14)
  assert.equal(logic.evaluate({ contains: ['Hello World', 'world'] }, {}), true)
  assert.equal(logic.evaluate({ exists: ['user', 'name'] }, data), true)
  assert.deepEqual(logic.evaluate({ preserve: { var: 'x' } }, {}), { var: 'x' })
})

test('reports static data dependencies outside iteration scopes', () => {
  const deps = logic.dependencies({
    and: [
      { '==': [{ var: 'vars.status' }, 'open'] },
      { some: [{ var: 'data.tasks' }, { '==': [{ var: 'owner' }, 'me'] }] },
      { missing: ['form.email'] },
    ],
  })
  assert.deepEqual(deps.sort(), ['data.tasks', 'form.email', 'vars.status'])
})

test('framed queries filter, search, sort, page, select and bind parameters safely', () => {
  const rows = [
    { id: 1, name: 'Lamp', price: 89, category: 'Lighting', stock: 0 },
    { id: 2, name: 'Chair', price: 249, category: 'Furniture', stock: 4 },
    { id: 3, name: 'Mug', price: 18, category: 'Kitchen', stock: 12 },
    { id: 4, name: 'Desk', price: 499, category: 'Furniture', stock: 2 },
  ]
  const filter = groupToLogic({
    combinator: 'and',
    conditions: [
      { field: 'category', operator: 'eq', value: 'category', source: 'param' },
      { field: 'stock', operator: 'gt', value: '0' },
    ],
  })
  const result = runQuery(
    rows,
    {
      filter,
      sort: [{ field: 'price', direction: 'desc' }],
      select: ['name', 'price'],
      limit: 1,
    },
    logic,
    { category: 'Furniture' },
  )
  assert.equal(result.total, 2)
  assert.deepEqual(result.rows, [{ name: 'Desk', price: 499 }])
  // A parameter that looks like a rule stays a literal value.
  const injected = runQuery(rows, { filter }, logic, {
    category: { var: 'category' },
  })
  assert.equal(injected.total, 0)
  assert.deepEqual(bindParams({ '==': [1, { param: 'x' }] }, { x: [1, 2] }), {
    '==': [1, { preserve: [1, 2] }],
  })
  assert.equal(
    runQuery(rows, { search: { term: 'MU', fields: ['name'] } }, logic).total,
    1,
  )
  assert.deepEqual(
    runQuery(
      rows,
      { offset: 1, limit: 2, sort: [{ field: 'name', direction: 'asc' }] },
      logic,
    ).rows.map((row) => row.name),
    ['Desk', 'Lamp'],
  )
  assert.throws(
    () => runQuery(rows, { filter: { nope: [] } }, logic),
    /Invalid filter/,
  )
  assert.deepEqual(
    runQuery(
      rows,
      {
        limit: 2,
        transform: {
          object: [
            ['label', { cat: [{ var: 'name' }, ' · $', { var: 'price' }] }],
          ],
        },
      },
      logic,
    ).rows,
    [{ label: 'Lamp · $89' }, { label: 'Chair · $249' }],
  )
})
