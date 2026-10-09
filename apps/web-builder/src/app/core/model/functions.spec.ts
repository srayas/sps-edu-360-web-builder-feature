import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  TEMPLATES,
  callFunction,
  createProject,
  evaluateExpr,
  flatten,
  instantiate,
  logic,
  mergeTemplateData,
  normalizeProject,
  parseParamValue,
  setFunctions,
  validateExpr,
} from './index'
import type { LogicFunction } from './index'

const fn = (
  name: string,
  params: string[],
  rule: unknown,
  defaults: Record<string, string> = {},
): LogicFunction => ({
  id: crypto.randomUUID(),
  name,
  params: params.map((param) => ({
    name: param,
    ...(defaults[param] ? { defaultValue: defaults[param] } : {}),
  })),
  body: { kind: 'rule', rule },
})

test('functions are callable from any expression with field inputs, defaults and nesting', () => {
  setFunctions([
    fn(
      'lineTotal',
      ['qty', 'price', 'discount'],
      {
        round: [
          {
            '*': [
              { var: 'qty' },
              { var: 'price' },
              { '-': [1, { var: 'discount' }] },
            ],
          },
          2,
        ],
      },
      { discount: '0' },
    ),
    fn(
      'withTax',
      ['amount', 'rate'],
      {
        '+': [{ var: 'amount' }, { '*': [{ var: 'amount' }, { var: 'rate' }] }],
      },
      { rate: '0.18' },
    ),
    fn('orderTotal', ['qty', 'price'], {
      fn: ['withTax', { fn: ['lineTotal', { var: 'qty' }, { var: 'price' }] }],
    }),
  ])
  const scope = { fields: { qty: '3', price: '19.99', loyal: true } }
  assert.equal(
    evaluateExpr(
      {
        kind: 'rule',
        rule: {
          fn: ['lineTotal', { var: 'fields.qty' }, { var: 'fields.price' }],
        },
      },
      scope,
    ),
    59.97,
  )
  assert.equal(
    evaluateExpr(
      {
        kind: 'rule',
        rule: {
          fn: [
            'lineTotal',
            { var: 'fields.qty' },
            { var: 'fields.price' },
            0.1,
          ],
        },
      },
      scope,
    ),
    53.97,
  )
  assert.equal(
    Math.round((callFunction('orderTotal', [2, 50]) as number) * 100) / 100,
    118,
  )
  assert.deepEqual(
    logic
      .analyze({
        fn: ['lineTotal', { var: 'fields.qty' }, { var: 'fields.price' }],
      })
      .paths.sort(),
    ['fields.price', 'fields.qty'],
  )
  assert.equal(
    validateExpr({ kind: 'rule', rule: { fn: ['lineTotal', 1, 2] } }),
    '',
  )
  assert.throws(() => callFunction('missing', []), /Unknown function/)
})

test('function results are memoized and recursion is bounded', () => {
  let calls = 0
  logic.addOperator('countCall', { fn: () => ++calls, pure: false })
  setFunctions([
    fn('counted', ['x'], {
      '+': [{ var: 'x' }, { '*': [0, { countCall: [] }] }],
    }),
    fn('loop', ['x'], { fn: ['loop', { var: 'x' }] }),
  ])
  callFunction('counted', [1])
  callFunction('counted', [1])
  callFunction('counted', [2])
  assert.equal(calls, 2, 'the same arguments are computed once')
  assert.throws(() => callFunction('loop', [1]), /too deeply/)
  assert.equal(parseParamValue('42'), 42)
  assert.equal(parseParamValue('true'), true)
  assert.deepEqual(parseParamValue('[1,2]'), [1, 2])
  assert.equal(parseParamValue('hello'), 'hello')
})

test('the smart order template ships a function and a workflow with parallel steps', () => {
  const template = TEMPLATES.find((item) => item.id === 'page-order')!
  const project = createProject('Order')
  const refs = mergeTemplateData(project, template)
  project.pages[0].blocks = instantiate(template.blocks, refs)
  const loaded = normalizeProject(JSON.parse(JSON.stringify(project)))
  assert.equal(loaded.functions?.[0].name, 'lineTotal')
  const workflow = loaded.workflows![0]
  assert.equal(workflow.name, 'Place order')
  assert.deepEqual(
    workflow.steps.map((step) => step.type),
    ['compute', 'parallel'],
  )
  assert.equal(workflow.steps[1].branches?.length, 2)
  assert.equal(workflow.steps[1].branches?.[0][0].options?.['saveAs'], 'tax')
  const form = flatten(loaded.pages[0].blocks)
    .map((entry) => entry.block)
    .find((block) => block.type === 'form')!
  assert.equal(form.actions[0].type, 'runWorkflow')
  assert.equal(
    form.actions[0].target,
    workflow.id,
    '@workflow: references resolve',
  )
  setFunctions(loaded.functions)
  const total = flatten(loaded.pages[0].blocks)
    .map((entry) => entry.block)
    .find((block) => block.props['field'] === 'total')!
  assert.equal(
    evaluateExpr(total.logic.value, {
      fields: { qty: '40', price: '30', loyalty: true },
    }),
    1080,
  )

  const broken = JSON.parse(JSON.stringify(loaded))
  broken.functions.push({ ...broken.functions[0], id: crypto.randomUUID() })
  assert.throws(() => normalizeProject(broken), /duplicate function/)
})
