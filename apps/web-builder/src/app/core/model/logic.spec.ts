import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  createBlock,
  createProject,
  evaluateExpr,
  exprPaths,
  findValueCycles,
  normalizeProject,
  templateToRule,
  toChoices,
  validateExpr,
} from './index'

test('templates convert to JSON Logic and keep single-value types', () => {
  assert.deepEqual(templateToRule('Hi {{fields.name}}!'), {
    cat: ['Hi ', { var: 'fields.name' }, '!'],
  })
  assert.deepEqual(templateToRule('{{ fields.qty }}'), { var: 'fields.qty' })
  assert.equal(templateToRule(''), '')

  assert.deepEqual(
    evaluateExpr(
      { kind: 'template', text: '{{fields.items}}' },
      { fields: { items: [1, 2] } },
    ),
    [1, 2],
  )
})

test('condition groups evaluate against fields, including field-to-field comparisons', () => {
  const expr = {
    kind: 'conditions' as const,
    group: {
      combinator: 'and' as const,
      conditions: [
        {
          field: 'fields.type',
          operator: 'eq' as const,
          value: 'business',
          source: 'literal' as const,
        },
        {
          combinator: 'or' as const,
          conditions: [
            {
              field: 'fields.total',
              operator: 'gt' as const,
              value: 'fields.limit',
              source: 'field' as const,
            },
            { field: 'fields.vat', operator: 'not_empty' as const },
          ],
        },
      ],
    },
  }
  assert.equal(
    evaluateExpr(expr, { fields: { type: 'business', total: 50, limit: 10 } }),
    true,
  )
  assert.equal(
    evaluateExpr(expr, {
      fields: { type: 'business', total: 5, limit: 10, vat: '' },
    }),
    false,
  )
  assert.equal(
    evaluateExpr(expr, { fields: { type: 'person', total: 50, limit: 10 } }),
    false,
  )
  assert.deepEqual(exprPaths(expr).sort(), [
    'fields.limit',
    'fields.total',
    'fields.type',
    'fields.vat',
  ])
})

test('invalid expressions report errors and evaluate to the fallback', () => {
  assert.notEqual(validateExpr({ kind: 'rule', rule: { no_such_op: [1] } }), '')
  assert.equal(
    evaluateExpr({ kind: 'rule', rule: { no_such_op: [1] } }, {}, 'fallback'),
    'fallback',
  )
  assert.equal(
    validateExpr({
      kind: 'rule',
      rule: { '*': [{ var: 'fields.qty' }, { var: 'fields.price' }] },
    }),
    '',
  )
})

test('choices accept text lists and record lists', () => {
  assert.deepEqual(toChoices(['A', 'B']), [
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
  ])
  assert.deepEqual(toChoices([{ name: 'Paris', id: 7 }]), [
    { label: 'Paris', value: '7' },
  ])
  assert.deepEqual(toChoices('nope'), [])
})

test('computed-value cycles are detected', () => {
  assert.deepEqual(
    findValueCycles([
      { name: 'a', reads: ['fields.b'] },
      { name: 'b', reads: ['fields.c', 'vars.x'] },
      { name: 'c', reads: ['fields.a'] },
      { name: 'd', reads: ['fields.a'] },
    ]),
    [['a', 'b', 'c', 'a']],
  )
  assert.deepEqual(
    findValueCycles([{ name: 'total', reads: ['fields.qty', 'fields.price'] }]),
    [],
  )
})

test('project normalization keeps valid logic and rejects broken logic', () => {
  const project = createProject('Logic')
  const block = createBlock('input')
  block.logic = { visible: { kind: 'template', text: '{{fields.show}}' } }
  project.pages[0].blocks.push(block)
  project.pages[0].rules.push({
    id: 'r1',
    name: 'Business',
    enabled: true,
    when: {
      kind: 'conditions',
      group: {
        combinator: 'and',
        conditions: [
          {
            field: 'fields.type',
            operator: 'eq',
            value: 'business',
            source: 'literal',
          },
        ],
      },
    },
    effects: [{ id: 'e1', target: block.id, kind: 'require' }],
    otherwise: [],
  })
  const normalized = normalizeProject(JSON.parse(JSON.stringify(project)))
  assert.deepEqual(normalized.pages[0].blocks.at(-1)?.logic.visible, {
    kind: 'template',
    text: '{{fields.show}}',
  })
  assert.equal(normalized.pages[0].rules[0].effects[0].kind, 'require')

  const broken = JSON.parse(JSON.stringify(project))
  broken.pages[0].blocks.at(-1).logic.visible = {
    kind: 'rule',
    rule: { no_such_op: [] },
  }
  assert.throws(() => normalizeProject(broken))
})

test('the smart order template carries working logic', async () => {
  const { TEMPLATES, instantiate, flatten } = await import('./index')
  const template = TEMPLATES.find((item) => item.id === 'page-order')
  assert.ok(template)
  const blocks = flatten(
    instantiate(template.blocks, { sources: {}, variables: {} } as never),
  ).map((entry) => entry.block)
  const byField = (name: string) =>
    blocks.find((block) => block.props['field'] === name)
  const city = byField('city')!
  assert.deepEqual(
    evaluateExpr(city.logic.options, { fields: { country: 'India' } }),
    ['Bengaluru', 'Chennai', 'Kochi', 'Mumbai'],
  )
  assert.deepEqual(evaluateExpr(city.logic.options, { fields: {} }), [])
  assert.equal(
    evaluateExpr(byField('total')!.logic.value, {
      fields: { qty: '3', price: '19.99', loyalty: true },
    }),
    53.97,
  )
  const company = blocks.find((block) => block.name === 'Company details')!
  assert.equal(
    evaluateExpr(company.logic.visible, {
      fields: { customerType: 'Business' },
    }),
    true,
  )
  assert.equal(
    evaluateExpr(company.logic.visible, { fields: { customerType: 'Person' } }),
    false,
  )
  // The page survives a save/load round trip.
  const project = createProject('Order')
  project.pages[0].blocks = instantiate(template.blocks, {
    sources: {},
    variables: {},
  } as never)
  assert.doesNotThrow(() =>
    normalizeProject(JSON.parse(JSON.stringify(project))),
  )
})
