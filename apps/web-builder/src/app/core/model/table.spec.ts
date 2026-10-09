import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  TEMPLATES,
  duplicateBlock,
  isEditableCell,
  validateValue,
  cellValue,
  computeSpans,
  createProject,
  flatten,
  formatCell,
  headerLayout,
  instantiate,
  mergeTemplateData,
  normalizeProject,
  parseRowRange,
  resolveTone,
  rowScope,
} from './index'
import type { TableColumn, TableMerge } from './index'

const col = (id: string, extra: Partial<TableColumn> = {}): TableColumn => ({
  id,
  field: id,
  header: id,
  format: 'text',
  align: 'start',
  sortable: true,
  ...extra,
})
const rows = [
  { region: 'North', city: 'Leeds', kind: '', qty: 1 },
  { region: 'North', city: 'York', kind: '', qty: 2 },
  { region: 'North', city: 'Total', kind: 'subtotal', qty: 3 },
  { region: 'South', city: 'Bath', kind: '', qty: 4 },
]
const columns = [
  col('region', { mergeEqual: true }),
  col('city'),
  col('kind'),
  col('qty'),
]
const shape = (grid: ReturnType<typeof computeSpans>) =>
  grid.map((row) =>
    row
      .map((cell) => (cell.hidden ? '·' : `${cell.rowspan}x${cell.colspan}`))
      .join(' '),
  )

test('equal adjacent values merge into one cell', () => {
  assert.deepEqual(shape(computeSpans(rows, columns, [], {})), [
    '3x1 1x1 1x1 1x1',
    '· 1x1 1x1 1x1',
    '· 1x1 1x1 1x1',
    '1x1 1x1 1x1 1x1',
  ])
})

test('conditional merges span columns for matching rows only', () => {
  const merge: TableMerge = {
    id: 'm',
    column: 'city',
    colspan: 2,
    rowspan: 1,
    when: { kind: 'rule', rule: { '==': [{ var: 'row.kind' }, 'subtotal'] } },
  }
  assert.deepEqual(shape(computeSpans(rows, columns, [merge], {})), [
    '3x1 1x1 1x1 1x1',
    '· 1x1 1x1 1x1',
    '· 1x2 · 1x1',
    '1x1 1x1 1x1 1x1',
  ])
})

test('static merges use 1-based row positions, honour paging offsets and never overlap', () => {
  const merge: TableMerge = {
    id: 'm',
    column: 'city',
    colspan: 2,
    rowspan: 2,
    rows: '1',
  }
  assert.deepEqual(shape(computeSpans(rows, columns, [merge], {})), [
    '3x1 2x2 · 1x1',
    '· · · 1x1',
    '· 1x1 1x1 1x1',
    '1x1 1x1 1x1 1x1',
  ])
  // On a second page starting at row 11, "row 11" is the first visible row.
  assert.deepEqual(
    shape(
      computeSpans(
        rows.slice(0, 2),
        [col('city'), col('qty')],
        [{ ...merge, column: 'city', rowspan: 1, rows: '11' }],
        {},
        10,
      ),
    ),
    ['1x2 ·', '1x1 1x1'],
  )
  // A span is clipped to the table edge.
  assert.deepEqual(
    shape(
      computeSpans(
        rows.slice(0, 1),
        [col('city'), col('qty')],
        [{ ...merge, colspan: 9, rowspan: 9, rows: '1' }],
        {},
      ),
    ),
    ['1x2 ·'],
  )
  assert.deepEqual([...parseRowRange('1, 3-4,x')], [1, 3, 4])
})

test('neighbour rows are available to conditions (prev / next)', () => {
  const merge: TableMerge = {
    id: 'm',
    column: 'qty',
    colspan: 1,
    rowspan: 2,
    when: {
      kind: 'rule',
      rule: { '==': [{ var: 'row.region' }, { var: 'next.region' }] },
    },
  }
  const grid = computeSpans(rows, [col('qty')], [merge], {})
  assert.deepEqual(shape(grid), ['2x1', '·', '1x1', '1x1'])
})

test('computed cells, formats, tones and header groups', () => {
  const total = col('total', {
    field: '',
    value: {
      kind: 'rule',
      rule: { '*': [{ var: 'row.qty' }, { var: 'row.price' }] },
    },
    format: 'currency',
    formatOptions: { currency: 'EUR', decimals: '0' },
  })
  const scope = rowScope({}, [{ qty: 3, price: 12.5 }], 0)
  assert.equal(cellValue(total, scope), 37.5)
  assert.match(formatCell(37.5, total, 'en-US'), /€38/)
  assert.equal(
    formatCell('2026-09-02', { format: 'date' }, 'en-US'),
    'Sep 2, 2026',
  )
  assert.equal(formatCell(0.256, { format: 'percent' }, 'en-US'), '25.6%')
  assert.equal(formatCell(true, { format: 'boolean' }), 'Yes')
  assert.equal(
    resolveTone(
      [
        {
          id: 'a',
          tone: 'error',
          when: { kind: 'rule', rule: { '<': [{ var: 'row.qty' }, 2] } },
        },
      ],
      { row: { qty: 1 } },
    ),
    'error',
  )
  assert.equal(
    resolveTone(
      [
        {
          id: 'a',
          tone: 'error',
          when: { kind: 'rule', rule: { '<': [{ var: 'row.qty' }, 2] } },
        },
      ],
      { row: { qty: 5 } },
    ),
    '',
  )
  assert.deepEqual(
    headerLayout(columns, [
      { id: 'g', label: 'Place', column: 'city', span: 2 },
    ]).map((item) => [item.label, item.span]),
    [
      ['', 1],
      ['Place', 2],
      ['', 1],
    ],
  )
})

test('the orders template keeps its table configuration through save and load', () => {
  const template = TEMPLATES.find((item) => item.id === 'page-orders')!
  const project = createProject('Orders')
  const refs = mergeTemplateData(project, template)
  project.pages[0].blocks = instantiate(template.blocks, refs)
  const loaded = normalizeProject(JSON.parse(JSON.stringify(project)))
  const blocks = flatten(loaded.pages[0].blocks).map((entry) => entry.block)
  const table = blocks.find((block) => block.type === 'table')!.table!
  assert.equal(table.columns.length, 11)
  assert.equal(
    table.merges[0].column,
    table.columns[1].id,
    'merge columns are remapped to the new column ids',
  )
  assert.equal(table.headerGroups[1].column, table.columns[3].id)
  const edit = blocks.find((block) => block.name === 'Edit order')!
  assert.equal(table.rowActions[1].actions[0].target, edit.id)
  assert.equal(
    table.rowActions[2].actions[0].onSuccess?.[0].type,
    'deleteRecord',
  )
  assert.equal(
    table.rowActions[2].actions[0].onSuccess?.[0].target,
    loaded.dataSources[0].id,
  )
  const customer = blocks.find((block) => block.props['field'] === 'customer')!
  assert.equal(customer.props['defaultValue'], '{{row.customer}}')
})

test('editable and custom-block cells survive save and load, and duplicates keep their cell blocks', () => {
  const template = TEMPLATES.find((item) => item.id === 'page-orders')!
  const project = createProject('Orders')
  const refs = mergeTemplateData(project, template)
  project.pages[0].blocks = instantiate(template.blocks, refs)
  const loaded = normalizeProject(JSON.parse(JSON.stringify(project)))
  const tableBlock = flatten(loaded.pages[0].blocks)
    .map((entry) => entry.block)
    .find((block) => block.type === 'table')!
  const table = tableBlock.table!
  const qty = table.columns.find((column) => column.field === 'qty')!
  assert.equal(qty.cell, 'number')
  assert.equal(qty.autoSave, true)
  assert.ok(qty.cellWhen, 'cell type applies to some rows only')
  assert.equal(validateValue(qty.validations!, 0, {}, 'Qty'), 'At least 1.')
  assert.equal(validateValue(qty.validations!, 3, {}, 'Qty'), '')
  const priority = table.columns.find((column) => column.field === 'priority')!
  assert.equal(priority.cell, 'checkbox')
  assert.equal(priority.onChange?.[0].trigger, 'change')
  const followUp = table.columns.find(
    (column) => column.header === 'Follow-up',
  )!
  const holder = tableBlock.children.find(
    (child) => child.id === followUp.cellBlock,
  )
  assert.equal(
    holder?.type,
    'table-cell',
    'custom cell points at its holder block',
  )
  assert.equal(holder?.children[0].type, 'button')
  const copy = duplicateBlock(tableBlock)
  const copied = copy.table!.columns.find(
    (column) => column.header === 'Follow-up',
  )!
  assert.notEqual(copied.cellBlock, followUp.cellBlock)
  assert.equal(
    copy.children.find((child) => child.id === copied.cellBlock)?.type,
    'table-cell',
  )
  assert.equal(isEditableCell('checkbox'), true)
  assert.equal(isEditableCell('blocks'), false)
  assert.equal(isEditableCell(undefined), false)
})
