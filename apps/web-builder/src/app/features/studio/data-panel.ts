import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatDividerModule } from '@angular/material/divider'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import {
  DataSource,
  Expr,
  KeyValue,
  QueryFrame,
  SortSpec,
  Variable,
} from '../../core/model'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { BuilderStore } from './builder-store'
import { ExprEditor } from './logic/expr-editor'
import { PathOption, scopePaths } from './logic/scope-paths'

/** App state: variables (plain or computed) and data sources framed as queries or API actions. */
@Component({
  selector: 'wb-data-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    ExprEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-panel.html',
})
export class DataPanel {
  readonly store = inject(BuilderStore)
  readonly runtime = inject(SiteRuntime)
  readonly errors = signal<Record<string, string>>({})
  readonly methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

  readonly scopeOptions = computed(() =>
    scopePaths(this.store.project(), this.store.page(), (id) =>
      Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
    ),
  )
  /** Page values a query may use (computed variables and data are excluded to avoid loops). */
  readonly queryInputs = computed(() =>
    this.scopeOptions().filter(
      (option) =>
        option.group === 'Fields' ||
        option.group === 'Page' ||
        (option.group === 'Variables' && !option.label.includes('(computed)')),
    ),
  )

  icon(source: DataSource): string {
    if (source.kind === 'rest')
      return source.mode === 'mutation' ? 'send' : 'api'
    return source.kind === 'collection' ? 'inventory_2' : 'data_array'
  }

  rawKeys(source: DataSource): string[] {
    return Object.keys(this.runtime.raw()[source.id]?.[0] ?? {}).slice(0, 40)
  }

  rowOptions(source: DataSource): PathOption[] {
    return this.rawKeys(source).map((key) => ({
      path: key,
      label: key,
      group: 'Row',
    }))
  }

  rawCount(source: DataSource): number {
    return this.runtime.raw()[source.id]?.length ?? 0
  }

  private report(key: string, message: string): void {
    this.errors.update((errors) => ({ ...errors, [key]: message }))
  }

  // Variables -------------------------------------------------------------------------------------
  renameVariable(variable: Variable, name: string): void {
    this.report(
      variable.id,
      this.store.updateVariable(variable.id, { name: name.trim() }),
    )
  }

  toggleFormula(variable: Variable, on: boolean): void {
    this.store.updateVariable(variable.id, {
      formula: on ? { kind: 'template', text: '' } : undefined,
    })
  }

  setFormula(variable: Variable, expr: Expr | undefined): void {
    this.store.updateVariable(variable.id, { formula: expr })
  }

  // Sources ---------------------------------------------------------------------------------------
  patch(source: DataSource, patch: Partial<DataSource>): void {
    const error = this.store.updateSource(source.id, patch)
    if (patch.name !== undefined) this.report(`${source.id}:name`, error)
    if (patch.json !== undefined) this.report(`${source.id}:json`, error)
  }

  setMode(source: DataSource, mode: DataSource['mode']): void {
    this.patch(source, {
      mode,
      method:
        mode === 'mutation'
          ? source.method === 'GET'
            ? 'POST'
            : source.method
          : 'GET',
      autoLoad: mode === 'query',
    })
  }

  frame(source: DataSource, patch: Partial<QueryFrame>): void {
    this.patch(source, { query: { ...source.query, ...patch } })
  }

  setFilter(source: DataSource, expr: Expr | undefined): void {
    this.frame(source, { filter: expr })
  }

  setTransform(source: DataSource, expr: Expr | undefined): void {
    this.frame(source, { transform: expr })
  }

  pairs(source: DataSource, key: 'params' | 'headers', next: KeyValue[]): void {
    this.patch(source, { [key]: next } as Partial<DataSource>)
  }

  addPair(source: DataSource, key: 'params' | 'headers'): void {
    this.pairs(source, key, [
      ...source[key],
      { key: key === 'params' ? 'q' : 'X-Header', value: '' },
    ])
  }

  editPair(
    source: DataSource,
    key: 'params' | 'headers',
    index: number,
    patch: Partial<KeyValue>,
  ): void {
    this.pairs(
      source,
      key,
      source[key].map((pair, position) =>
        position === index ? { ...pair, ...patch } : pair,
      ),
    )
  }

  removePair(
    source: DataSource,
    key: 'params' | 'headers',
    index: number,
  ): void {
    this.pairs(
      source,
      key,
      source[key].filter((_, position) => position !== index),
    )
  }

  addSort(source: DataSource): void {
    this.frame(source, {
      sort: [
        ...source.query.sort,
        { field: this.rawKeys(source)[0] ?? 'id', direction: 'asc' as const },
      ].slice(0, 5),
    })
  }

  editSort(source: DataSource, index: number, patch: Partial<SortSpec>): void {
    this.frame(source, {
      sort: source.query.sort.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    })
  }

  removeSort(source: DataSource, index: number): void {
    this.frame(source, {
      sort: source.query.sort.filter((_, position) => position !== index),
    })
  }

  setBody(source: DataSource, body: string): void {
    this.patch(source, { body })
  }

  insertIntoBody(source: DataSource, path: string): void {
    const body = source.body.trim() ? source.body : '{\n  \n}'
    this.patch(source, {
      body: body.replace(
        /\n}\s*$/,
        `\n  "${path.split('.').pop()}": "{{${path}}}"\n}`,
      ),
    })
  }
}
