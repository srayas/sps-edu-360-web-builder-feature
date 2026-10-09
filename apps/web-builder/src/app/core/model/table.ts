/**
 * Data table logic shared by the renderer, the studio and tests: column defaults, cell values and
 * formatting, and the merge (rowspan/colspan) computation for static, equal-value and conditional
 * merges. Pure functions — no Angular.
 */
import { truthy } from '@spsedu360/json-logic'
import { evaluateExpr } from './logic'
import type {
  Action,
  CellKind,
  ColumnFormat,
  TableColumn,
  TableConfig,
  TableHeaderGroup,
  TableMerge,
  TableRowAction,
  Tone,
  ToneRule,
} from './types'

const id = () => crypto.randomUUID()

/** What a column's cells render: formatted display, an editor, or custom blocks. */
export const CELL_KINDS: {
  value: CellKind
  label: string
  icon: string
  hint: string
}[] = [
  {
    value: 'display',
    label: 'Display value',
    icon: 'visibility',
    hint: 'Shows the value with the column format.',
  },
  {
    value: 'input',
    label: 'Text input',
    icon: 'edit_note',
    hint: 'People type a new value.',
  },
  {
    value: 'number',
    label: 'Number input',
    icon: 'pin',
    hint: 'People type a number.',
  },
  {
    value: 'checkbox',
    label: 'Checkbox',
    icon: 'check_box',
    hint: 'Yes / no, toggled in place.',
  },
  {
    value: 'switch',
    label: 'Switch',
    icon: 'toggle_on',
    hint: 'On / off, toggled in place.',
  },
  {
    value: 'select',
    label: 'Dropdown',
    icon: 'arrow_drop_down_circle',
    hint: 'Pick from options you type or compute per row.',
  },
  { value: 'date', label: 'Date picker', icon: 'event', hint: 'Pick a date.' },
  {
    value: 'blocks',
    label: 'Custom blocks',
    icon: 'dashboard_customize',
    hint: 'Design the cell with any blocks — buttons, badges, images, fields.',
  },
]

/** True for cells people can change in place. */
export function isEditableCell(kind: CellKind | undefined): boolean {
  return !!kind && kind !== 'display' && kind !== 'blocks'
}

export const COLUMN_FORMATS: {
  value: ColumnFormat
  label: string
  icon: string
}[] = [
  { value: 'text', label: 'Text', icon: 'notes' },
  { value: 'number', label: 'Number', icon: 'pin' },
  { value: 'currency', label: 'Currency', icon: 'payments' },
  { value: 'percent', label: 'Percent', icon: 'percent' },
  { value: 'date', label: 'Date', icon: 'calendar_today' },
  { value: 'datetime', label: 'Date and time', icon: 'schedule' },
  { value: 'boolean', label: 'Yes / no', icon: 'check_box' },
  { value: 'badge', label: 'Badge', icon: 'label' },
  { value: 'link', label: 'Link', icon: 'link' },
  { value: 'image', label: 'Image', icon: 'image' },
  { value: 'avatar', label: 'Avatar', icon: 'account_circle' },
  { value: 'progress', label: 'Progress bar', icon: 'linear_scale' },
]

export const TONES: { value: Tone; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'primary', label: 'Primary' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'info', label: 'Info' },
  { value: 'muted', label: 'Muted' },
]
const TONE_NAMES = new Set(TONES.map((tone) => tone.value))

export function emptyTable(): TableConfig {
  return { columns: [], rowActions: [], merges: [], headerGroups: [] }
}

export function createColumn(field: string, header = field): TableColumn {
  return {
    id: id(),
    field,
    header: header || field,
    format: 'text',
    align: 'start',
    sortable: true,
  }
}

export type RowActionPreset = 'view' | 'edit' | 'delete' | 'custom'

/** Ready-made row actions; `dialogId`/`collectionId` pre-fill their targets when known. */
export function createRowAction(
  preset: RowActionPreset,
  refs: { dialogId?: string; collectionId?: string } = {},
): TableRowAction {
  const step = (
    type: Action['type'],
    target = '',
    value = '',
    extra: Partial<Action> = {},
  ): Action => ({ id: id(), trigger: 'click', type, target, value, ...extra })
  switch (preset) {
    case 'view':
      return {
        id: id(),
        label: 'View',
        icon: 'visibility',
        display: 'icon',
        actions: [step('openDialog', refs.dialogId ?? '')],
      }
    case 'edit':
      return {
        id: id(),
        label: 'Edit',
        icon: 'edit',
        display: 'icon',
        actions: [step('openDialog', refs.dialogId ?? '')],
      }
    case 'delete':
      return {
        id: id(),
        label: 'Delete',
        icon: 'delete',
        display: 'icon',
        danger: true,
        actions: [
          step('confirm', '', 'This row will be deleted permanently.', {
            options: {
              title: 'Delete this row?',
              confirmLabel: 'Delete',
              danger: 'true',
            },
            onSuccess: [
              step('deleteRecord', refs.collectionId ?? '', '{{row.id}}', {
                onSuccess: [
                  step('showMessage', '', 'Row deleted.', {
                    options: { severity: 'success' },
                  }),
                ],
              }),
            ],
          }),
        ],
      }
    case 'custom':
      return {
        id: id(),
        label: 'Action',
        icon: 'bolt',
        display: 'text',
        actions: [],
      }
  }
}

export function createMerge(column: string): TableMerge {
  return { id: id(), column, colspan: 2, rowspan: 1, rows: '1' }
}

export function createHeaderGroup(
  column: string,
  label = 'Group',
): TableHeaderGroup {
  return { id: id(), label, column, span: 2 }
}

/** Row scope for expressions: the page scope plus `row`, `index` (0-based), `prev` and `next`. */
export function rowScope(
  scope: Record<string, unknown>,
  rows: readonly Record<string, unknown>[],
  index: number,
) {
  return {
    ...scope,
    row: rows[index] ?? {},
    index,
    prev: rows[index - 1] ?? null,
    next: rows[index + 1] ?? null,
  }
}

const readField = (row: Record<string, unknown>, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      row,
    )

/** The raw value of a cell: the computed `value` expression, or the row's `field`. */
export function cellValue(
  column: TableColumn,
  scope: Record<string, unknown>,
): unknown {
  const row = (scope['row'] ?? {}) as Record<string, unknown>
  if (column.value) return evaluateExpr(column.value, scope, null)
  return column.field ? readField(row, column.field) : null
}

export function createToneRule(field = 'row.status'): ToneRule {
  return {
    id: id(),
    tone: 'warning',
    when: {
      kind: 'conditions',
      group: {
        combinator: 'and',
        conditions: [{ field, operator: 'not_empty', source: 'literal' }],
      },
    },
  }
}

/** The tone of the first rule whose condition holds ('' when none). */
export function resolveTone(
  rules: readonly ToneRule[] | undefined,
  scope: Record<string, unknown>,
): Tone {
  for (const rule of rules ?? [])
    if (truthy(evaluateExpr(rule.when, scope, false))) return rule.tone
  return ''
}

export function toTone(value: unknown): Tone {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
  return TONE_NAMES.has(text as Tone)
    ? (text as Tone)
    : truthy(value) && typeof value === 'boolean'
      ? 'primary'
      : ''
}

/** Display text of a value in a column's format (images, links… use `href`/`src` from the value). */
export function formatCell(
  value: unknown,
  column: Pick<TableColumn, 'format' | 'formatOptions'>,
  locale?: string,
): string {
  if (value === null || value === undefined || value === '') return ''
  const options = column.formatOptions ?? {}
  const decimals =
    options['decimals'] === undefined || options['decimals'] === ''
      ? undefined
      : Math.min(Math.max(Number(options['decimals']) || 0, 0), 6)
  const number =
    typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  try {
    switch (column.format) {
      case 'number':
        return Number.isFinite(number)
          ? new Intl.NumberFormat(locale, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals ?? 2,
            }).format(number)
          : String(value)
      case 'currency':
        return Number.isFinite(number)
          ? new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: (options['currency'] || 'USD').toUpperCase(),
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals ?? 2,
            }).format(number)
          : String(value)
      case 'percent': {
        if (!Number.isFinite(number)) return String(value)
        const ratio = options['scale'] === '100' ? number / 100 : number
        return new Intl.NumberFormat(locale, {
          style: 'percent',
          maximumFractionDigits: decimals ?? 1,
        }).format(ratio)
      }
      case 'date':
      case 'datetime': {
        const date =
          value instanceof Date
            ? value
            : new Date(typeof value === 'number' ? value : String(value))
        if (Number.isNaN(date.getTime())) return String(value)
        return new Intl.DateTimeFormat(
          locale,
          column.format === 'date'
            ? {
                dateStyle:
                  (options['style'] as 'short' | 'medium' | 'long') || 'medium',
              }
            : { dateStyle: 'medium', timeStyle: 'short' },
        ).format(date)
      }
      case 'boolean':
        return truthy(value) && String(value).toLowerCase() !== 'false'
          ? options['yes'] || 'Yes'
          : options['no'] || 'No'
      case 'link':
        return options['label'] || String(value)
      default:
        return typeof value === 'object' ? JSON.stringify(value) : String(value)
    }
  } catch {
    return String(value)
  }
}

export function initials(value: unknown): string {
  const words = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase()
}

/** "1-3, 5" → {1, 2, 3, 5} (1-based row positions). */
export function parseRowRange(
  text: string | undefined,
  max = 10_000,
): Set<number> {
  const out = new Set<number>()
  for (const part of String(text ?? '').split(',')) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part)
    if (!match) continue
    const from = Number(match[1])
    const to = Math.min(Number(match[2] ?? match[1]), from + max)
    for (let row = from; row <= to; row++) out.add(row)
  }
  return out
}

export interface CellSpan {
  rowspan: number
  colspan: number
  /** Covered by another cell's span: not rendered. */
  hidden: boolean
}

/**
 * Spans for the visible rows × columns.
 * 1. `mergeEqual` columns merge runs of equal values downwards (within the runs of the
 *    merge-equal columns to their left, so groups nest).
 * 2. Merges then extend cells right (colspan) and down (rowspan). Static merges use 1-based row
 *    positions counted from `offset` (the first visible row's position in the whole table).
 * A cell already covered by another span is never the start of a new one.
 */
export function computeSpans(
  rows: readonly Record<string, unknown>[],
  columns: readonly TableColumn[],
  merges: readonly TableMerge[],
  scope: Record<string, unknown>,
  offset = 0,
): CellSpan[][] {
  const grid: CellSpan[][] = rows.map(() =>
    columns.map(() => ({ rowspan: 1, colspan: 1, hidden: false })),
  )
  if (!rows.length || !columns.length) return grid
  const values = rows.map((_, index) =>
    columns.map((column) =>
      JSON.stringify(cellValue(column, rowScope(scope, rows, index)) ?? null),
    ),
  )

  // 1. Equal-value merges (hierarchical: a run never crosses a boundary of a column to its left).
  const boundaries = new Set<number>([0])
  columns.forEach((column, c) => {
    if (!column.mergeEqual) return
    let start = 0
    for (let r = 1; r <= rows.length; r++) {
      const breaks =
        r === rows.length ||
        boundaries.has(r) ||
        values[r][c] !== values[start][c]
      if (!breaks) continue
      if (r - start > 1) {
        grid[start][c].rowspan = r - start
        for (let k = start + 1; k < r; k++) grid[k][c].hidden = true
      }
      boundaries.add(r)
      start = r
    }
  })

  // 2. Static and conditional merges.
  const indexOf = new Map(columns.map((column, c) => [column.id, c]))
  for (const merge of merges) {
    const c = indexOf.get(merge.column)
    if (c === undefined) continue
    const positions = merge.when ? null : parseRowRange(merge.rows)
    for (let r = 0; r < rows.length; r++) {
      if (
        positions
          ? !positions.has(offset + r + 1)
          : !truthy(evaluateExpr(merge.when!, rowScope(scope, rows, r), false))
      )
        continue
      const cell = grid[r][c]
      if (cell.hidden) continue
      const colspan = Math.max(
        1,
        Math.min(Math.floor(merge.colspan) || 1, columns.length - c),
      )
      const rowspan = Math.max(
        1,
        Math.min(Math.floor(merge.rowspan) || 1, rows.length - r),
      )
      // Shrink the span so it never overlaps cells that are already covered or spanning.
      let cols = 1
      while (
        cols < colspan &&
        !grid[r][c + cols].hidden &&
        grid[r][c + cols].rowspan === 1
      )
        cols++
      let rws = 1
      while (
        rws < rowspan &&
        Array.from({ length: cols }, (_, k) => grid[r + rws][c + k]).every(
          (other) =>
            !other.hidden && other.rowspan === 1 && other.colspan === 1,
        )
      )
        rws++
      cell.colspan = Math.max(cell.colspan, cols)
      cell.rowspan = Math.max(cell.rowspan, rws)
      for (let dr = 0; dr < cell.rowspan; dr++)
        for (let dc = 0; dc < cell.colspan; dc++)
          if (dr || dc) grid[r + dr][c + dc].hidden = true
    }
  }
  return grid
}

/** Header groups laid out over the visible columns: groups plus empty fillers. */
export function headerLayout(
  columns: readonly TableColumn[],
  groups: readonly TableHeaderGroup[],
): { key: string; label: string; span: number }[] {
  const out: { key: string; label: string; span: number }[] = []
  for (let c = 0; c < columns.length; c++) {
    const group = groups.find((item) => item.column === columns[c].id)
    if (group) {
      const span = Math.max(
        1,
        Math.min(Math.floor(group.span) || 1, columns.length - c),
      )
      out.push({ key: `group-${group.id}`, label: group.label, span })
      c += span - 1
    } else out.push({ key: `gap-${columns[c].id}`, label: '', span: 1 })
  }
  return out
}
