import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatSelectModule } from '@angular/material/select'
import { BlockList } from './block-list'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatTableDataSource, MatTableModule } from '@angular/material/table'
import { MatSort, MatSortModule } from '@angular/material/sort'
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { truthy } from '@spsedu360/json-logic'
import { BlockSkeleton } from './block-skeleton'
import {
  Block,
  CellKind,
  CellSpan,
  Scope,
  TableColumn,
  TableRowAction,
  Tone,
  blockClasses,
  cellValue,
  computeSpans,
  emptyTable,
  evaluateExpr,
  formatCell,
  headerLayout,
  initials,
  interpolate,
  lines,
  rowScope,
  safeUrl,
  stringify,
  isEditableCell,
  resolveTone,
  toChoices,
  validateValue,
} from '../../core/model'
import { Row, SiteRuntime } from '../../core/runtime/site-runtime'

interface CellView {
  /** How this cell renders (the column's cell type, unless its condition is false for the row). */
  kind: CellKind
  /** Unformatted value for editors ('' for empty). */
  raw: unknown
  options: { label: string; value: string }[]
  error: string
  text: string
  tone: Tone
  href: string
  src: string
  initials: string
  number: number
  flag: boolean
}

const ACTIONS = '__actions'

/**
 * Material data table. Columns come from the table configuration (formats, computed values,
 * conditional visibility and highlights) or, when none are configured, from the data itself.
 * Supports row actions, a row-click trigger, header groups and merged cells — static,
 * equal-value and conditional — recomputed for the visible (filtered, sorted, paged) rows.
 */
@Component({
  selector: 'wb-table-block',
  imports: [
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSelectModule,
    BlockSkeleton,
    forwardRef(() => BlockList),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  template: `
    @let b = block();
    @if (loading()) {
      <wb-block-skeleton
        [class]="classes()"
        type="table"
        [label]="b.name"
        [count]="pageSize()"
        [cols]="columns().length || 4"
      />
    } @else {
      <div [class]="classes() + ' ui-column ui-gap-2 ui-enter'">
        @if (b.props['filter']) {
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="wb-table-search"
          >
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Search</mat-label>
            <input
              matInput
              type="search"
              (input)="search.set($any($event.target).value)"
            />
          </mat-form-field>
        }
        @if (refreshing()) {
          <mat-progress-bar
            mode="indeterminate"
            class="wb-refresh-bar"
            aria-label="Refreshing"
          />
        }
        <div
          class="wb-table-scroll"
          [class.ui-outlined]="b.props['striped']"
          [class.mat-corner-md]="b.props['striped']"
        >
          <table
            mat-table
            [dataSource]="data"
            [trackBy]="trackRow"
            matSort
            [matSortDisabled]="!b.props['sortable']"
            class="ui-fill wb-table"
            [class.wb-table-clickable]="rowClickable()"
          >
            @for (group of groups(); track group.key) {
              <ng-container [matColumnDef]="group.key">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  [attr.colspan]="group.span > 1 ? group.span : null"
                  class="wb-th-group"
                  [class.wb-th-group-empty]="!group.label"
                >
                  {{ group.label }}
                </th>
              </ng-container>
            }
            @for (column of columns(); track column.id; let c = $index) {
              <ng-container [matColumnDef]="column.id">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  mat-sort-header
                  [disabled]="!column.sortable"
                  [arrowPosition]="column.align === 'end' ? 'before' : 'after'"
                  [class]="
                    'wb-align-' +
                    column.align +
                    (column.width ? ' wb-col-' + column.width : '')
                  "
                >
                  {{ column.header }}
                </th>
                <td
                  mat-cell
                  *matCellDef="let row; let i = index"
                  [attr.rowspan]="
                    span(i, c).rowspan > 1 ? span(i, c).rowspan : null
                  "
                  [attr.colspan]="
                    span(i, c).colspan > 1 ? span(i, c).colspan : null
                  "
                  [class]="cellClass(i, c, column)"
                >
                  @let cell = view(i, c);
                  @switch (cell.kind) {
                    @case ('input') {
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="wb-cell-field"
                        (click)="$event.stopPropagation()"
                      >
                        <input
                          matInput
                          [value]="cell.raw"
                          [placeholder]="column.placeholder ?? ''"
                          [attr.aria-label]="column.header"
                          (change)="
                            edit(row, i, column, $any($event.target).value)
                          "
                        />
                      </mat-form-field>
                      @if (cell.error) {
                        <span class="wb-cell-error" role="alert">{{
                          cell.error
                        }}</span>
                      }
                    }
                    @case ('number') {
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="wb-cell-field wb-cell-number"
                        (click)="$event.stopPropagation()"
                      >
                        <input
                          matInput
                          type="number"
                          [value]="cell.raw"
                          [placeholder]="column.placeholder ?? ''"
                          [attr.aria-label]="column.header"
                          (change)="
                            edit(row, i, column, $any($event.target).value)
                          "
                        />
                      </mat-form-field>
                      @if (cell.error) {
                        <span class="wb-cell-error" role="alert">{{
                          cell.error
                        }}</span>
                      }
                    }
                    @case ('date') {
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="wb-cell-field"
                        (click)="$event.stopPropagation()"
                      >
                        <input
                          matInput
                          type="date"
                          [value]="cell.raw"
                          [attr.aria-label]="column.header"
                          (change)="
                            edit(row, i, column, $any($event.target).value)
                          "
                        />
                      </mat-form-field>
                      @if (cell.error) {
                        <span class="wb-cell-error" role="alert">{{
                          cell.error
                        }}</span>
                      }
                    }
                    @case ('checkbox') {
                      <mat-checkbox
                        [checked]="cell.flag"
                        [attr.aria-label]="column.header"
                        (click)="$event.stopPropagation()"
                        (change)="edit(row, i, column, $event.checked)"
                      />
                    }
                    @case ('switch') {
                      <mat-slide-toggle
                        [checked]="cell.flag"
                        [attr.aria-label]="column.header"
                        (click)="$event.stopPropagation()"
                        (change)="edit(row, i, column, $event.checked)"
                      />
                    }
                    @case ('select') {
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="wb-cell-field"
                        (click)="$event.stopPropagation()"
                      >
                        <mat-select
                          [value]="cell.raw"
                          [placeholder]="column.placeholder ?? ''"
                          [attr.aria-label]="column.header"
                          (selectionChange)="edit(row, i, column, $event.value)"
                        >
                          @for (choice of cell.options; track choice.value) {
                            <mat-option [value]="choice.value">{{
                              choice.label
                            }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                      @if (cell.error) {
                        <span class="wb-cell-error" role="alert">{{
                          cell.error
                        }}</span>
                      }
                    }
                    @case ('blocks') {
                      @if (cellBlocks()[column.cellBlock ?? '']; as holder) {
                        <wb-block-list
                          [blocks]="holder.children"
                          [parentId]="holder.id"
                          parentType="table-cell"
                          [layoutClass]="cellLayout(holder)"
                          [scope]="rowScopes()[i]"
                          [readonly]="!(editing() && i === designRow(c))"
                        />
                      }
                    }
                    @default {
                      @switch (column.format) {
                        @case ('badge') {
                          @if (cell.text) {
                            <span
                              [class]="
                                'wb-badge wb-tone-' + (cell.tone || 'neutral')
                              "
                              >{{ cell.text }}</span
                            >
                          }
                        }
                        @case ('boolean') {
                          <mat-icon
                            [class]="cell.flag ? 'wb-bool-yes' : 'wb-bool-no'"
                            [attr.aria-label]="cell.text"
                            >{{
                              cell.flag
                                ? 'check_circle'
                                : 'remove_circle_outline'
                            }}</mat-icon
                          >
                        }
                        @case ('link') {
                          @if (cell.href) {
                            <a
                              [href]="cell.href"
                              target="_blank"
                              rel="noopener"
                              (click)="$event.stopPropagation()"
                              >{{ cell.text }}</a
                            >
                          } @else {
                            {{ cell.text }}
                          }
                        }
                        @case ('image') {
                          @if (cell.src) {
                            <img
                              [src]="cell.src"
                              alt=""
                              loading="lazy"
                              class="wb-cell-image"
                            />
                          }
                        }
                        @case ('avatar') {
                          <span class="ui-row ui-align-center ui-gap-2"
                            ><span class="wb-cell-avatar" aria-hidden="true">{{
                              cell.initials
                            }}</span
                            >{{ cell.text }}</span
                          >
                        }
                        @case ('progress') {
                          <span class="ui-row ui-align-center ui-gap-2"
                            ><mat-progress-bar
                              mode="determinate"
                              [value]="cell.number"
                              class="wb-cell-progress"
                              [attr.aria-label]="column.header"
                            /><span class="mat-font-body-sm">{{
                              cell.text
                            }}</span></span
                          >
                        }
                        @default {
                          {{ cell.text }}
                        }
                      }
                    }
                  }
                </td>
              </ng-container>
            }
            @if (rowActions().length) {
              <ng-container [matColumnDef]="actionsKey">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  class="wb-align-end wb-col-actions"
                >
                  <span class="ui-visually-hidden">Actions</span>
                </th>
                <td
                  mat-cell
                  *matCellDef="let row; let i = index"
                  class="wb-align-end wb-col-actions"
                >
                  <span class="wb-row-actions">
                    @for (
                      action of rowActions();
                      track action.id;
                      let a = $index
                    ) {
                      @if (actionShown(i, a)) {
                        @if (action.display === 'icon') {
                          <button
                            matIconButton
                            type="button"
                            class="wb-icon-button-sm"
                            [class.wb-danger]="action.danger"
                            [matTooltip]="action.label"
                            [attr.aria-label]="action.label"
                            [disabled]="busyRow() === i"
                            (click)="runRowAction($event, action, row, i)"
                          >
                            <mat-icon>{{ action.icon }}</mat-icon>
                          </button>
                        } @else {
                          <button
                            matButton
                            type="button"
                            [class.wb-danger]="action.danger"
                            [disabled]="busyRow() === i"
                            (click)="runRowAction($event, action, row, i)"
                          >
                            {{ action.label }}
                          </button>
                        }
                      }
                    }
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="gap-__actions"
                ><th
                  mat-header-cell
                  *matHeaderCellDef
                  class="wb-th-group wb-th-group-empty"
                ></th
              ></ng-container>
            }
            @if (groupKeys().length) {
              <tr
                mat-header-row
                *matHeaderRowDef="groupKeys()"
                class="wb-group-row"
              ></tr>
            }
            <tr mat-header-row *matHeaderRowDef="keys()"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: keys(); let i = index"
              [class]="rowClass(i)"
              (click)="rowClick(row, i)"
            ></tr>
            <tr class="mat-mdc-row" *matNoDataRow>
              <td
                class="mat-mdc-cell mat-text-on-surface-variant ui-p-4"
                [attr.colspan]="keys().length"
              >
                {{
                  search()
                    ? 'No rows match “' + search() + '”.'
                    : config().emptyText || 'No rows yet.'
                }}
              </td>
            </tr>
          </table>
        </div>
        @if (b.props['paginate']) {
          <mat-paginator
            [pageSize]="pageSize()"
            [pageSizeOptions]="[5, 10, 25, 50]"
            showFirstLastButtons
            aria-label="Select page"
          />
        }
      </div>
    }
  `,
})
export class TableBlock {
  readonly block = input.required<Block>()
  readonly scope = input.required<Scope>()
  private readonly runtime = inject(SiteRuntime)
  private readonly sort = viewChild(MatSort)
  private readonly paginator = viewChild(MatPaginator)

  readonly actionsKey = ACTIONS
  readonly data = new MatTableDataSource<Row>([])
  readonly search = signal('')
  readonly busyRow = signal(-1)
  /** Validation messages of edited cells, by "rowKey:columnId". */
  readonly cellErrors = signal<Partial<Record<string, string>>>({})
  /** Edits of typed (non-source) rows, by row position. */
  private readonly localEdits = signal<Record<number, Row>>({})
  readonly editing = computed(() => this.runtime.mode() === 'edit')
  /** Custom-cell holders (the table's "table-cell" children) by id. */
  readonly cellBlocks = computed<Record<string, Block>>(() =>
    Object.fromEntries(
      this.block()
        .children.filter((child) => child.type === 'table-cell')
        .map((child) => [child.id, child]),
    ),
  )
  readonly rowScopes = computed(() => {
    const scope = this.pageScope()
    return this.rendered().map((row, index) => ({
      ...scope,
      row,
      item: row,
      index,
    }))
  })
  readonly classes = computed(() => blockClasses(this.block()))
  readonly config = computed(() => this.block().table ?? emptyTable())
  readonly loading = computed(
    () =>
      !!this.block().props['source'] &&
      this.runtime.isLoading(String(this.block().props['source'])),
  )
  readonly refreshing = computed(
    () =>
      !!this.block().props['source'] &&
      this.runtime.isRefreshing(String(this.block().props['source'])),
  )
  readonly pageSize = computed(() =>
    Math.max(1, Number(this.block().props['pageSize']) || 5),
  )
  readonly rowClickable = computed(
    () =>
      this.runtime.hasActions(this.block().actions, 'rowClick') &&
      this.runtime.mode() !== 'edit',
  )

  /** Rows and auto-detected columns (used when no columns are configured). */
  private readonly source = computed<{ rows: Row[]; columns: TableColumn[] }>(
    () => {
      const props = this.block().props
      const sourceId = String(props['source'] ?? '')
      const auto = (field: string, header = field): TableColumn => ({
        id: `auto-${field}`,
        field,
        header: header || field,
        format: 'text',
        align: 'start',
        sortable: true,
      })
      if (sourceId) {
        const rows = this.runtime.rowsFor(sourceId)
        const listed = lines(props['columns']).map(([field, header]) =>
          auto(field, header),
        )
        const columns = listed.length
          ? listed
          : Object.keys(rows[0] ?? {})
              .filter((key) => key !== 'id')
              .map((key) => auto(key))
        return { rows, columns }
      }
      const [header = [], ...body] = lines(
        interpolate(props['items'], this.scope()),
      )
      const edits = this.localEdits()
      return {
        columns: header.map((label, index) => auto(`c${index}`, label)),
        rows: body.map((cells, position) => ({
          ...Object.fromEntries(
            cells.map((cell, index) => [`c${index}`, cell]),
          ),
          ...(edits[position] ?? {}),
          __position: position,
        })),
      }
    },
  )

  private readonly pageScope = computed(
    () => this.scope() as Record<string, unknown>,
  )
  readonly columns = computed(() => {
    const configured = this.config().columns
    const all = configured.length ? configured : this.source().columns
    const scope = this.pageScope()
    return all.filter(
      (column) =>
        !column.visible || truthy(evaluateExpr(column.visible, scope, true)),
    )
  })
  readonly rowActions = computed(() => this.config().rowActions)
  readonly groups = computed(() => {
    const groups = this.config().headerGroups
    if (!groups.length) return []
    return headerLayout(this.columns(), groups)
  })
  readonly groupKeys = computed(() =>
    this.groups().length
      ? [
          ...this.groups().map((group) => group.key),
          ...(this.rowActions().length ? ['gap-__actions'] : []),
        ]
      : [],
  )
  readonly keys = computed(() => [
    ...this.columns().map((column) => column.id),
    ...(this.rowActions().length ? [ACTIONS] : []),
  ])

  /** Rows currently on screen (after search, sort and paging). */
  private readonly rendered = toSignal(this.data.connect(), {
    initialValue: [] as Row[],
  })

  /** Cell view models for the visible rows. */
  private readonly cells = computed<CellView[][]>(() => {
    const rows = this.rendered()
    const columns = this.columns()
    const scope = this.pageScope()
    const errors = this.cellErrors()
    return rows.map((_, index) => {
      const local = rowScope(scope, rows, index)
      return columns.map((column) => {
        const value = cellValue(column, local)
        const number = Number(value)
        const tone = column.tones?.length
          ? resolveTone(column.tones, { ...local, value })
          : ''
        const text = formatCell(value, column)
        const kind: CellKind =
          column.cell &&
          column.cell !== 'display' &&
          (!column.cellWhen ||
            truthy(evaluateExpr(column.cellWhen, { ...local, value }, true)))
            ? column.cell
            : 'display'
        const editable = isEditableCell(kind)
        return {
          kind,
          raw: editable ? editorValue(value, kind) : '',
          options: kind === 'select' ? this.optionsFor(column, local) : [],
          error: editable
            ? (errors[`${rowKey(rows[index], index)}:${column.id}`] ?? '')
            : '',
          text,
          tone,
          href:
            column.format === 'link' ? safeUrl(String(value ?? '')) || '' : '',
          src:
            column.format === 'image' ? safeUrl(String(value ?? '')) || '' : '',
          initials: column.format === 'avatar' ? initials(value) : '',
          number: Number.isFinite(number)
            ? Math.min(
                Math.max(
                  column.formatOptions?.['scale'] === '1'
                    ? number * 100
                    : number,
                  0,
                ),
                100,
              )
            : 0,
          flag:
            (column.format === 'boolean' ||
              kind === 'checkbox' ||
              kind === 'switch') &&
            truthy(value) &&
            String(value).toLowerCase() !== 'false',
        }
      })
    })
  })

  /** Per column: the row whose custom cell is designed on the canvas (the first that shows it). */
  private readonly designRows = computed(() => {
    const cells = this.cells()
    return this.columns().map((_, column) =>
      cells.findIndex((row) => row[column]?.kind === 'blocks'),
    )
  })

  designRow(column: number): number {
    return this.designRows()[column] ?? -1
  }

  private readonly spans = computed<CellSpan[][]>(() => {
    const rows = this.rendered()
    const paginator = this.paginator()
    const offset = paginator ? paginator.pageIndex * paginator.pageSize : 0
    const columns = this.columns()
    const config = this.config()
    if (!config.merges.length && !columns.some((column) => column.mergeEqual))
      return []
    return computeSpans(rows, columns, config.merges, this.pageScope(), offset)
  })

  private readonly rowTones = computed<Tone[]>(() => {
    const rules = this.config().rowTones
    const rows = this.rendered()
    if (!rules?.length) return []
    const scope = this.pageScope()
    return rows.map((_, index) =>
      resolveTone(rules, rowScope(scope, rows, index)),
    )
  })

  private readonly actionVisibility = computed<boolean[][]>(() => {
    const rows = this.rendered()
    const actions = this.rowActions()
    const scope = this.pageScope()
    return rows.map((_, index) =>
      actions.map(
        (action) =>
          !action.visible ||
          truthy(
            evaluateExpr(action.visible, rowScope(scope, rows, index), true),
          ),
      ),
    )
  })

  constructor() {
    this.data.filterPredicate = (row, term) => {
      const scope = { ...this.pageScope(), row, index: 0 }
      return this.columns().some((column) =>
        formatCell(cellValue(column, scope), column)
          .toLowerCase()
          .includes(term),
      )
    }
    this.data.sortingDataAccessor = (row, key) => {
      const column = this.columns().find((item) => item.id === key)
      if (!column) return ''
      const value = cellValue(column, { ...this.pageScope(), row, index: 0 })
      if (typeof value === 'number') return value
      const text = stringify(value)
      const number = Number(text)
      if (
        text !== '' &&
        Number.isFinite(number) &&
        ['number', 'currency', 'percent', 'progress'].includes(column.format)
      )
        return number
      if (
        (column.format === 'date' || column.format === 'datetime') &&
        !Number.isNaN(Date.parse(text))
      )
        return Date.parse(text)
      return text.toLowerCase()
    }
    effect(() => {
      this.data.data = this.source().rows
    })
    effect(() => {
      this.data.filter = this.search().trim().toLowerCase()
    })
    effect(() => {
      this.data.sort = this.sort() ?? null
      this.data.paginator = this.paginator() ?? null
    })
  }

  private static readonly NO_SPAN: CellSpan = {
    rowspan: 1,
    colspan: 1,
    hidden: false,
  }

  span(row: number, column: number): CellSpan {
    return this.spans()[row]?.[column] ?? TableBlock.NO_SPAN
  }

  view(row: number, column: number): CellView {
    return (
      this.cells()[row]?.[column] ?? {
        kind: 'display',
        raw: '',
        options: [],
        error: '',
        text: '',
        tone: '',
        href: '',
        src: '',
        initials: '',
        number: 0,
        flag: false,
      }
    )
  }

  cellClass(row: number, column: number, def: TableColumn): string {
    const span = this.span(row, column)
    const tone = def.format === 'badge' ? '' : this.view(row, column).tone
    return [
      `wb-align-${def.align}`,
      def.width ? `wb-col-${def.width}` : '',
      tone ? `wb-cell-tone-${tone}` : '',
      span.hidden ? 'wb-cell-hidden' : '',
      span.rowspan > 1 || span.colspan > 1 ? 'wb-cell-merged' : '',
    ].join(' ')
  }

  rowClass(index: number): string {
    const tone = this.rowTones()[index]
    return tone ? `wb-row-tone-${tone}` : ''
  }

  actionShown(row: number, action: number): boolean {
    return this.actionVisibility()[row]?.[action] ?? true
  }

  async runRowAction(
    event: Event,
    action: TableRowAction,
    row: Row,
    index: number,
  ): Promise<void> {
    event.stopPropagation()
    if (this.runtime.mode() === 'edit' || this.busyRow() === index) return
    this.busyRow.set(index)
    try {
      await this.runtime.run(action.actions, 'click', {
        scope: { ...this.scope(), row, index },
      })
    } finally {
      this.busyRow.set(-1)
    }
  }

  cellLayout(holder: Block): string {
    return `ui-row ui-wrap ui-align-center ui-gap-${holder.props['gap'] ?? '2'}`
  }

  /** Dropdown choices: per-row expression, or the column's typed options. */
  optionsFor(
    column: TableColumn,
    scope: Record<string, unknown>,
  ): { label: string; value: string }[] {
    if (column.optionsExpr)
      return toChoices(evaluateExpr(column.optionsExpr, scope, []))
    return lines(column.options ?? '').map(([label, value]) => ({
      label,
      value: value ?? label,
    }))
  }

  /** Accepts a cell edit: validates, updates the data, optionally saves, then runs On change steps. */
  async edit(
    row: Row,
    index: number,
    column: TableColumn,
    input: unknown,
  ): Promise<void> {
    if (this.editing()) return
    const value =
      column.cell === 'number' ? (input === '' ? null : Number(input)) : input
    const key = `${rowKey(row, index)}:${column.id}`
    const scope = { ...this.pageScope(), row, index, value }
    const message = column.validations?.length
      ? validateValue(column.validations, value, scope, column.header)
      : ''
    this.cellErrors.update((errors) => ({ ...errors, [key]: message }))
    if (message) return
    const sourceId = String(this.block().props['source'] ?? '')
    let updated: Row = { ...row, [column.field]: value }
    if (sourceId)
      updated =
        this.runtime.setRowField(sourceId, row, column.field, value) ?? updated
    else if (typeof row['__position'] === 'number') {
      const position = row['__position'] as number
      this.localEdits.update((edits) => ({
        ...edits,
        [position]: { ...(edits[position] ?? {}), [column.field]: value },
      }))
    }
    if (column.autoSave && sourceId) {
      const result = await this.runtime.saveRowField(
        sourceId,
        updated,
        column.field,
        value,
      )
      if (!result.ok) {
        this.runtime.notify({
          severity: 'error',
          message: result.error?.message ?? 'Could not save the change.',
        })
        return
      }
    }
    if (column.onChange?.length)
      await this.runtime.run(column.onChange, 'change', {
        scope: { ...this.scope(), row: updated, value, index },
      })
  }

  /** Keeps row elements (and focus in editable cells) when a row's data changes. */
  readonly trackRow = (index: number, row: Row): unknown =>
    row['id'] ?? row['__position'] ?? index

  rowClick(row: Row, index: number): void {
    if (!this.rowClickable()) return
    void this.runtime.run(this.block().actions, 'rowClick', {
      scope: { ...this.scope(), row, index },
    })
  }
}

/** Stable key of a row for edit state: its id, else its position. */
function rowKey(row: Row | undefined, index: number): string {
  const id = row?.['id']
  return id !== undefined && id !== null && id !== ''
    ? `id:${String(id)}`
    : `#${index}`
}

/** Value shown by an editor (dates as YYYY-MM-DD, empty as ''). */
function editorValue(value: unknown, kind: TableColumn['cell']): unknown {
  if (value === null || value === undefined)
    return kind === 'checkbox' || kind === 'switch' ? false : ''
  if (kind === 'date') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
  }
  if (kind === 'select') return String(value)
  return value
}
