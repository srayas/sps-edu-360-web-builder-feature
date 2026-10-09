import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  TEMPLATES,
  createProject,
  flatten,
  instantiate,
  normalizeProject,
  parseServerErrors,
  passes,
  validateValue,
} from './index'
import type { ValidationRule } from './index'

const rule = (
  kind: ValidationRule['kind'],
  extra: Partial<ValidationRule> = {},
): ValidationRule => ({ id: kind, kind, ...extra })

test('preset rules accept good values, reject bad ones and ignore empty values', () => {
  assert.equal(passes(rule('email'), 'ada@example.com'), true)
  assert.equal(passes(rule('email'), 'ada@'), false)
  assert.equal(passes(rule('email'), ''), true)
  assert.equal(passes(rule('phone'), '+91 98450 12345'), true)
  assert.equal(passes(rule('phone'), '12-34'), false)
  assert.equal(passes(rule('url'), 'https://spsedu360.com/a?b=1'), true)
  assert.equal(passes(rule('url'), 'javascript:alert(1)'), false)
  assert.equal(passes(rule('integer'), '42'), true)
  assert.equal(passes(rule('integer'), '4.2'), false)
  assert.equal(passes(rule('letters'), "Anne-Marie O'Neil"), true)
  assert.equal(passes(rule('letters'), 'R2D2'), false)
  assert.equal(passes(rule('alphanumeric'), 'R2D2'), true)
  assert.equal(passes(rule('required'), ''), false)
  assert.equal(passes(rule('required'), false), false)
  assert.equal(passes(rule('required'), ['a']), true)
})

test('limits work for text, numbers, dates, lists and other fields', () => {
  assert.equal(passes(rule('minLength', { value: '3' }), 'ab'), false)
  assert.equal(
    passes(rule('maxLength', { value: '2' }), ['a', 'b', 'c']),
    false,
  )
  assert.equal(passes(rule('min', { value: '18' }), '17'), false)
  assert.equal(passes(rule('min', { value: '18' }), '18'), true)
  assert.equal(
    passes(rule('max', { value: '2026-12-31' }), '2027-01-01'),
    false,
  )
  const scope = { fields: { start: '2026-05-01', password: 'Secret1x' } }
  assert.equal(
    passes(rule('min', { value: '{{fields.start}}' }), '2026-04-30', scope),
    false,
  )
  assert.equal(
    passes(rule('matchField', { value: 'password' }), 'Secret1x', scope),
    true,
  )
  assert.equal(
    passes(rule('matchField', { value: 'password' }), 'secret', scope),
    false,
  )
  assert.equal(
    passes(rule('pattern', { value: '^[A-Z]{2}[0-9]{4}$' }), 'AB1234'),
    true,
  )
  assert.equal(
    passes(rule('pattern', { value: '([' }), 'anything'),
    true,
    'invalid patterns never block people',
  )
})

test('custom and conditional rules use the page scope and the value', () => {
  const custom = rule('custom', {
    expr: {
      kind: 'rule',
      rule: { '>': [{ var: 'value' }, { var: 'fields.min' }] },
    },
  })
  assert.equal(passes(custom, 5, { fields: { min: 3 } }), true)
  assert.equal(passes(custom, 2, { fields: { min: 3 } }), false)
  const conditional = rule('required', {
    when: {
      kind: 'conditions',
      group: {
        combinator: 'and',
        conditions: [
          {
            field: 'fields.type',
            operator: 'eq',
            value: 'Business',
            source: 'literal',
          },
        ],
      },
    },
  })
  assert.equal(passes(conditional, '', { fields: { type: 'Person' } }), true)
  assert.equal(passes(conditional, '', { fields: { type: 'Business' } }), false)
  assert.equal(
    validateValue(
      [rule('required'), rule('email', { message: 'Work email please' })],
      'x',
      {},
      'Email',
    ),
    'Work email please',
  )
  assert.equal(
    validateValue([rule('required')], '', {}, 'Email'),
    'Email is required.',
  )
  assert.equal(
    validateValue([rule('email')], 'ada@example.com', {}, 'Email'),
    '',
  )
})

test('server field errors are read from common API shapes', () => {
  assert.deepEqual(
    parseServerErrors({
      message: 'Invalid input',
      errors: { email: ['Already taken'] },
    }),
    { message: 'Invalid input', fields: { email: 'Already taken' } },
  )
  assert.deepEqual(
    parseServerErrors({ errors: [{ field: 'phone', message: 'Bad phone' }] })
      .fields,
    { phone: 'Bad phone' },
  )
  assert.deepEqual(
    parseServerErrors({
      errors: [
        { property: 'age', constraints: { min: 'age must be at least 18' } },
      ],
    }).fields,
    { age: 'age must be at least 18' },
  )
  assert.deepEqual(
    parseServerErrors({
      fieldErrors: { name: 'Required' },
      detail: 'Validation failed',
    }),
    { message: 'Validation failed', fields: { name: 'Required' } },
  )
  assert.deepEqual(parseServerErrors('Service unavailable'), {
    message: 'Service unavailable',
    fields: {},
  })
})

test('nested success/error steps, options and validation rules survive save and load', () => {
  const template = TEMPLATES.find((item) => item.id === 'page-signup')
  assert.ok(template)
  const project = createProject('Sign-up')
  project.pages[0].blocks = instantiate(template.blocks, {
    sources: {},
    variables: {},
  } as never)
  const loaded = normalizeProject(JSON.parse(JSON.stringify(project)))
  const blocks = flatten(loaded.pages[0].blocks).map((entry) => entry.block)
  const form = blocks.find((block) => block.type === 'form')!
  const submit = form.actions[0]
  assert.equal(submit.type, 'submitForm')
  assert.equal(submit.onSuccess?.[0].type, 'openDialog')
  const welcome = blocks.find((block) => block.name === 'Welcome')!
  assert.equal(
    submit.onSuccess?.[0].target,
    welcome.id,
    '@block: references resolve to block ids',
  )
  assert.equal(submit.onError?.[0].options?.['severity'], 'error')
  const confirm = blocks.find(
    (block) => block.type === 'button' && block.actions[0]?.type === 'confirm',
  )!.actions[0]
  assert.equal(confirm.options?.['danger'], 'true')
  assert.equal(confirm.onSuccess?.[0].type, 'resetForm')
  assert.equal(
    confirm.onSuccess?.[0].trigger,
    'click',
    'nested steps inherit the trigger',
  )
  const confirmPassword = blocks.find(
    (block) => block.props['field'] === 'confirmPassword',
  )!
  assert.deepEqual(
    confirmPassword.validations?.map((item) => [item.kind, item.value]),
    [['matchField', 'password']],
  )

  const broken = JSON.parse(JSON.stringify(project))
  broken.pages[0].blocks[1].children[0].children[2].children[0].actions[0].onSuccess =
    [{ type: 'explode' }]
  assert.throws(() => normalizeProject(broken))
})
