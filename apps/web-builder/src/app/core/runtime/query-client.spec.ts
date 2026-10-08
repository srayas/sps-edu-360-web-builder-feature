import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { createSource } from '../model'
import {
  applyFrame,
  frameQuery,
  interpolateJson,
  interpolateUrl,
  resolveRequest,
} from './query-client'
import { backoff, isRetryableStatus } from './request-queue'

const rows = [
  { id: 1, name: 'Ada', city: 'London', score: 91 },
  { id: 2, name: 'Grace', city: 'New York', score: 78 },
  { id: 3, name: 'Alan', city: 'London', score: 85 },
  { id: 4, name: 'Linus', city: 'Helsinki', score: 60 },
]

test('JSON bodies take typed values and stay valid when values contain quotes', () => {
  const scope = {
    form: { a: 1, b: 'x"y' },
    fields: { qty: 3, name: 'A "quoted" name' },
  }
  const body = interpolateJson(
    '{"data": "{{form}}", "n": {{fields.qty}}, "msg": "Hi {{fields.name}}!", "raw": "{{fields.name}}"}',
    scope,
  )
  assert.deepEqual(JSON.parse(body), {
    data: { a: 1, b: 'x"y' },
    n: 3,
    msg: 'Hi A "quoted" name!',
    raw: 'A "quoted" name',
  })
  assert.equal(
    interpolateUrl('/api/items/{{fields.name}}', scope),
    '/api/items/A%20%22quoted%22%20name',
  )
})

test('requests are built from the source without forbidden headers', () => {
  const source = createSource('Save', 'rest', {
    mode: 'mutation',
    method: 'POST',
    url: 'https://api.example.com/people/{{fields.id}}',
    params: [
      { key: 'notify', value: '{{fields.notify}}' },
      { key: 'empty', value: '' },
    ],
    headers: [
      { key: 'X-Tenant', value: 'acme\r\nInjected: 1' },
      { key: 'Cookie', value: 'session=1' },
    ],
    body: '{"name": "{{fields.name}}"}',
  })
  const request = resolveRequest(source, {
    fields: { id: 'a/b', notify: 'yes', name: 'Ada' },
  })
  assert.ok(request)
  assert.equal(request.url, 'https://api.example.com/people/a%2Fb?notify=yes')
  assert.deepEqual(request.headers, {
    'X-Tenant': 'acmeInjected: 1',
    'Content-Type': 'application/json',
  })
  assert.deepEqual(JSON.parse(request.body ?? ''), { name: 'Ada' })
  assert.equal(
    resolveRequest(
      createSource('Bad', 'rest', { url: 'javascript:alert(1)' }),
      {},
    ),
    null,
  )
})

test('framed queries filter, search, sort, limit and select without user-written queries', () => {
  const source = createSource('People', 'json', {
    query: {
      filter: {
        kind: 'conditions',
        group: {
          combinator: 'and',
          conditions: [
            {
              field: 'city',
              operator: 'eq',
              value: 'fields.city',
              source: 'param',
            },
          ],
        },
      },
      search: '{{fields.term}}',
      searchFields: ['name'],
      sort: [{ field: 'score', direction: 'desc' }],
      limit: 5,
      select: ['name', 'score'],
    },
  })
  const scope = { fields: { city: 'London', term: 'a' } }
  const { params } = frameQuery(source, scope)
  assert.deepEqual(params, { 'fields.city': 'London' })
  assert.deepEqual(applyFrame(rows, source, scope), {
    rows: [
      { name: 'Ada', score: 91 },
      { name: 'Alan', score: 85 },
    ],
    total: 2,
  })
  // A hostile value is data, never logic.
  assert.deepEqual(
    applyFrame(rows, source, { fields: { city: { or: [true] }, term: '' } })
      .rows,
    [],
  )
})

test('frames without settings pass rows through untouched', () => {
  const source = createSource('All', 'json')
  const result = applyFrame(rows, source, {})
  assert.equal(result.rows, rows)
  assert.equal(result.total, 4)
})

test('retry policy', () => {
  assert.ok(
    isRetryableStatus(0) && isRetryableStatus(429) && isRetryableStatus(503),
  )
  assert.ok(!isRetryableStatus(400) && !isRetryableStatus(404))
  for (let attempt = 0; attempt < 6; attempt++)
    assert.ok(backoff(attempt) <= 10_000)
})
