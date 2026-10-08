import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core'
import { MatTableDataSource, MatTableModule } from '@angular/material/table'
import { MatSort, MatSortModule } from '@angular/material/sort'
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { BlockSkeleton } from './block-skeleton'
import {
  Block,
  Scope,
  blockClasses,
  interpolate,
  lines,
  lookup,
  stringify,
} from '../../core/model'
import { Row, SiteRuntime } from '../../core/runtime/site-runtime'

interface Column {
  key: string
  label: string
}

/** Material data table with optional search, sorting and paging; rows come from a data source or typed items. */
@Component({
  selector: 'wb-table-block',
  imports: [
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    BlockSkeleton,
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
            matSort
            [matSortDisabled]="!b.props['sortable']"
            class="ui-fill"
          >
            @for (column of columns(); track column.key) {
              <ng-container [matColumnDef]="column.key">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ column.label }}
                </th>
                <td mat-cell *matCellDef="let row">
                  {{ cell(row, column.key) }}
                </td>
              </ng-container>
            }
            <tr mat-header-row *matHeaderRowDef="keys()"></tr>
            <tr mat-row *matRowDef="let row; columns: keys()"></tr>
            <tr class="mat-mdc-row" *matNoDataRow>
              <td
                class="mat-mdc-cell mat-text-on-surface-variant ui-p-4"
                [attr.colspan]="keys().length"
              >
                {{
                  search()
                    ? 'No rows match “' + search() + '”.'
                    : 'No rows yet.'
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

  readonly data = new MatTableDataSource<Row>([])
  readonly search = signal('')
  readonly classes = computed(() => blockClasses(this.block()))
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

  private readonly table = computed<{ columns: Column[]; rows: Row[] }>(() => {
    const props = this.block().props
    const source = String(props['source'] ?? '')
    if (source) {
      const rows = this.runtime.rowsFor(source)
      const configured = lines(props['columns']).map(([key, label]) => ({
        key,
        label: label || key,
      }))
      const columns = configured.length
        ? configured
        : Object.keys(rows[0] ?? {})
            .filter((key) => key !== 'id')
            .map((key) => ({ key, label: key }))
      return { columns, rows }
    }
    const [header = [], ...body] = lines(
      interpolate(props['items'], this.scope()),
    )
    const columns = header.map((label, index) => ({ key: `c${index}`, label }))
    return {
      columns,
      rows: body.map((cells) =>
        Object.fromEntries(cells.map((cell, index) => [`c${index}`, cell])),
      ),
    }
  })
  readonly columns = computed(() => this.table().columns)
  readonly keys = computed(() => this.columns().map((column) => column.key))

  constructor() {
    this.data.filterPredicate = (row, term) =>
      this.keys().some((key) =>
        stringify(lookup(row, key)).toLowerCase().includes(term),
      )
    this.data.sortingDataAccessor = (row, key) => {
      const value = lookup(row, key)
      return typeof value === 'number' ? value : stringify(value).toLowerCase()
    }
    effect(() => {
      this.data.data = this.table().rows
    })
    effect(() => {
      this.data.filter = this.search().trim().toLowerCase()
    })
    effect(() => {
      this.data.sort = this.sort() ?? null
      this.data.paginator = this.paginator() ?? null
    })
  }

  cell(row: Row, key: string): string {
    return stringify(lookup(row, key))
  }
}
