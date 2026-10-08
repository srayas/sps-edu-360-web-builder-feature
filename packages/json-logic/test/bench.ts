/**
 * Micro-benchmark: compiled engine vs the reference json-logic-js interpreter on rules typical
 * for the builder (visibility checks, row filters, computed values).
 */
import reference from 'json-logic-js'
import { logic } from '../src/index'

const rules: Record<string, { rule: unknown; data: unknown }> = {
  'visibility check': {
    rule: {
      and: [
        { '==': [{ var: 'vars.signedIn' }, 'true'] },
        { '>': [{ var: 'vars.cartCount' }, 0] },
      ],
    },
    data: { vars: { signedIn: 'true', cartCount: 3 } },
  },
  'row filter': {
    rule: {
      and: [
        { '==': [{ var: 'category' }, 'Furniture'] },
        { '<=': [100, { var: 'price' }, 500] },
        { in: [{ var: 'status' }, ['active', 'new']] },
      ],
    },
    data: { category: 'Furniture', price: 249, status: 'active' },
  },
  'computed total': {
    rule: {
      reduce: [
        { var: 'items' },
        {
          '+': [
            { var: 'accumulator' },
            { '*': [{ var: 'current.price' }, { var: 'current.qty' }] },
          ],
        },
        0,
      ],
    },
    data: {
      items: Array.from({ length: 20 }, (_, i) => ({ price: i + 1, qty: 2 })),
    },
  },
  'nested conditions': {
    rule: {
      if: [
        { '<': [{ var: 'temp' }, 0] },
        'freezing',
        { '<': [{ var: 'temp' }, 100] },
        'liquid',
        'gas',
      ],
    },
    data: { temp: 55 },
  },
}

function measure(fn: () => unknown, iterations: number): number {
  for (let i = 0; i < 2000; i++) fn()
  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) fn()
  return Number(process.hrtime.bigint() - start) / iterations
}

const N = 300_000
console.log(
  `${'rule'.padEnd(20)} ${'json-logic-js'.padStart(14)} ${'compiled'.padStart(10)} ${'speed-up'.padStart(9)}`,
)
for (const [name, { rule, data }] of Object.entries(rules)) {
  const compiled = logic.compile(rule)
  const expected = JSON.stringify(reference.apply(rule as never, data))
  if (JSON.stringify(compiled(data)) !== expected)
    throw new Error(`Mismatch for ${name}`)
  const a = measure(() => reference.apply(rule as never, data), N)
  const b = measure(() => compiled(data), N)
  console.log(
    `${name.padEnd(20)} ${`${a.toFixed(0)} ns`.padStart(14)} ${`${b.toFixed(0)} ns`.padStart(10)} ${`${(a / b).toFixed(1)}×`.padStart(9)}`,
  )
}
