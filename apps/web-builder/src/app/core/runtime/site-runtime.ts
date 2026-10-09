import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  Injector,
  Signal,
  Type,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import {
  MatSnackBar,
  MatSnackBarHorizontalPosition,
  MatSnackBarVerticalPosition,
} from '@angular/material/snack-bar'
import { ConfirmService } from '@spsedu360/shared-ui'
import { MatDialog } from '@angular/material/dialog'
import { readPath, truthy as logicTruthy } from '@spsedu360/json-logic'
import {
  Action,
  Block,
  BlockLogic,
  DataSource,
  Expr,
  NotificationSeverity,
  Page,
  PageRule,
  Project,
  Scope,
  Trigger,
  compileExpr,
  createProject,
  evaluateExpr,
  exprPaths,
  fieldName,
  findBlock,
  flatten,
  interpolate,
  isFormField,
  newId,
  parseParamValue,
  parseServerErrors,
  setFunctions,
  safeEndpoint,
  safeUrl,
  themeScopeClasses,
  truthy,
} from '../model'
import { BUILDER_CONFIG } from '../persistence/project-repository'
import type { FormScope } from './form-scope'
import {
  QueryClient,
  applyFrame,
  interpolateJson,
  resolveRequest,
} from './query-client'
import { RequestError, RequestQueue } from './request-queue'
import { narrowed, useLogicVersion } from './narrow'
import { NotificationData, NotificationToast } from './notification-toast'

export type RuntimeMode = 'edit' | 'preview' | 'live'
export type Row = Record<string, unknown>
export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ActionContext {
  scope: Scope
  form?: FormScope | null
  /** Results saved by earlier steps (`saveAs`), readable as `{{steps.name}}`; shared by branches. */
  steps?: Record<string, unknown>
  /** Workflow call depth (guards against workflows calling each other forever). */
  depth?: number
}

interface StepsOutcome {
  ok: boolean
  response?: unknown
}

export interface ActionError {
  message: string
  status: number
  body: unknown
}

/** Outcome of one step: success with an optional response, or a failure. */
export interface ActionResult {
  ok: boolean
  response?: unknown
  error?: ActionError
  /** Failures that need no error notification (e.g. a cancelled confirmation). */
  quiet?: boolean
}

export interface NotifyOptions {
  message: string
  severity?: NotificationSeverity
  title?: string
  /** Seconds; 0 keeps it until dismissed. */
  duration?: number
  position?: string
  actionLabel?: string
}

const done = (response?: unknown): ActionResult => ({ ok: true, response })
const failed = (
  message: string,
  status = 0,
  body: unknown = null,
): ActionResult => ({ ok: false, error: { message, status, body } })

/** Effects of page rules on one block. */
export interface Overlay {
  visible?: boolean
  enabled?: boolean
  required?: boolean
  props?: Record<string, unknown>
}

/** Component used to render a dialog block inside a Material dialog (set by the renderer). */
export const DIALOG_HOST: { component?: Type<unknown> } = {}

const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* full or blocked */
    }
  },
}

const parseRows = (json: string): Row[] => {
  try {
    const value: unknown = JSON.parse(json || '[]')
    return Array.isArray(value)
      ? value.map((row) =>
          row && typeof row === 'object' ? (row as Row) : { value: row },
        )
      : []
  } catch {
    return []
  }
}

const EMPTY_OVERLAYS = new Map<string, Overlay>()

/**
 * Runs a builder project.
 *
 * Scope layers (each a signal, recomputed only when its inputs change):
 *   1. inputs   – variable values, live field values, page and app
 *   2. data     – every data source's rows after its framed query (filter/search/sort/limit/select)
 *   3. computed variables (formulas over inputs + data)
 *   4. scope    – everything above; what bindings, rules and templates read
 *
 * One instance is provided per rendered site (the studio canvas or the published app).
 */
@Injectable()
export class SiteRuntime {
  private readonly document = inject(DOCUMENT)
  private readonly snack = inject(MatSnackBar)
  private readonly dialog = inject(MatDialog)
  private readonly confirmService = inject(ConfirmService)
  private readonly injector = inject(Injector)
  private readonly api = inject(BUILDER_CONFIG).apiBaseUrl.replace(/\/+$/, '')
  private readonly queries = new QueryClient()
  readonly queue = new RequestQueue()

  readonly mode = signal<RuntimeMode>('edit')
  readonly project = signal<Project>(createProject())
  readonly pageId = signal('')
  readonly page = computed<Page>(
    () =>
      this.project().pages.find((page) => page.id === this.pageId()) ??
      this.project().pages[0],
  )
  readonly themeClasses = computed(() =>
    themeScopeClasses(this.project().theme),
  )

  /** Plain variable values by variable id. */
  readonly values = signal<Record<string, string>>({})
  /** Live values of form fields on the page, by field name. */
  readonly fields = signal<Record<string, unknown>>({})
  /** One-off writes to fields (rules and "Set field value" actions), by field name. */
  readonly fieldWrites = signal<
    Record<string, { value: unknown; seq: number }>
  >({})
  /** Raw rows by data source id (before framing). */
  readonly raw = signal<Record<string, Row[]>>({})
  readonly status = signal<Record<string, SourceStatus>>({})
  readonly errors = signal<Record<string, string>>({})

  // 1. Inputs ---------------------------------------------------------------------------------
  readonly inputs = computed<Scope>(() => {
    const project = this.project()
    const values = this.values()
    const vars: Record<string, unknown> = {}
    for (const variable of project.variables)
      if (!variable.formula)
        vars[variable.name] = values[variable.id] ?? variable.initial
    const page = this.page()
    return {
      vars,
      fields: this.fields(),
      page: { name: page.name, slug: page.slug, title: page.title },
      app: { name: project.name },
    }
  })

  // 2. Data (framed per source; each source only re-frames when its own inputs change) -------
  private readonly framed = new Map<
    string,
    Signal<{ rows: Row[]; total: number }>
  >()
  readonly data = computed(() => {
    const out: Record<string, Row[]> = {}
    const totals: Record<string, number> = {}
    for (const source of this.project().dataSources) {
      if (source.mode === 'mutation') continue
      const result = this.framedSignal(source.id)()
      out[source.name] = result.rows
      totals[source.name] = result.total
    }
    return { rows: out, totals }
  })

  // 3 + 4. Computed variables and full scope -----------------------------------------------------
  /** Installs the project's functions (compiled once) whenever they change. */
  readonly logicVersion = computed(() => {
    const list = this.project().functions
    setFunctions(list)
    return JSON.stringify(list ?? [])
  })

  readonly scope = computed<Scope>(() => {
    this.logicVersion()
    const inputs = this.inputs()
    const data = this.data()
    const vars: Record<string, unknown> = {
      ...(inputs['vars'] as Record<string, unknown>),
    }
    const scope: Scope = {
      ...inputs,
      vars,
      data: data.rows,
      totals: data.totals,
    }
    for (const variable of this.project().variables) {
      if (variable.formula)
        vars[variable.name] = evaluateExpr(variable.formula, scope, null)
    }
    return scope
  })

  /** Effects of the current page's rules, by block id. */
  readonly overlays = narrowed(
    this.scope,
    () => this.rulesDependencies(),
    (scope) => this.evaluateRules(this.page().rules, scope),
    () => this.page().rules,
  )

  private navigateHandler: (pageId: string) => void = (id) =>
    this.pageId.set(id)
  private writeSeq = 0
  /** Publish counts per field in the current window — stops computed fields that feed each other forever. */
  private readonly bursts = new Map<string, { at: number; count: number }>()

  constructor() {
    useLogicVersion(this.logicVersion)
    const variablesKey = computed(
      () =>
        JSON.stringify(
          this.project().variables.map((v) => [v.id, v.initial, v.persist]),
        ) +
        this.project().id +
        this.mode(),
    )
    effect(() => {
      variablesKey()
      untracked(() => this.initVariables())
    })
    const staticKey = computed(
      () =>
        JSON.stringify(
          this.project()
            .dataSources.filter((s) => s.kind !== 'rest')
            .map((s) => [s.id, s.kind, s.json]),
        ) +
        this.project().id +
        this.mode(),
    )
    effect(() => {
      staticKey()
      untracked(() => this.initStaticSources())
    })
    // Page change: clear field values that belonged to the previous page.
    effect(() => {
      this.pageId()
      untracked(() => this.fields.set({}))
    })
    this.watchRestSources()
    this.watchRuleTransitions()
  }

  onNavigate(handler: (pageId: string) => void): void {
    this.navigateHandler = handler
  }

  // -------------------------------------------------------------------------------------------
  // Variables and fields
  // -------------------------------------------------------------------------------------------

  private varKey(id: string): string {
    return `wb-var:${this.project().id}:${id}`
  }

  private initVariables(): void {
    const previous = this.values()
    const next: Record<string, string> = {}
    for (const variable of this.project().variables) {
      const persisted =
        variable.persist && this.mode() !== 'edit'
          ? storage.get(this.varKey(variable.id))
          : null
      next[variable.id] =
        this.mode() === 'edit'
          ? variable.initial
          : (previous[variable.id] ?? persisted ?? variable.initial)
    }
    this.values.set(next)
  }

  /** Current value of a variable (computed variables included), as text. */
  value(variableId: string): string {
    const variable = this.project().variables.find(
      (item) => item.id === variableId,
    )
    if (!variable) return ''
    if (variable.formula) {
      const value = (this.scope()['vars'] as Record<string, unknown>)[
        variable.name
      ]
      return value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    }
    return this.values()[variableId] ?? variable.initial
  }

  setValue(variableId: string, value: unknown): void {
    const variable = this.project().variables.find(
      (item) => item.id === variableId,
    )
    if (!variable || variable.formula) return
    const text =
      value === null || value === undefined
        ? ''
        : Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value)
    if (this.values()[variableId] === text) return
    this.values.update((values) => ({ ...values, [variableId]: text }))
    if (variable.persist && this.mode() !== 'edit')
      storage.set(this.varKey(variableId), text)
  }

  /** Publishes a field's live value into `fields.*`. */
  publishField(name: string, value: unknown): void {
    if (Object.is(this.fields()[name], value)) return
    const now = Date.now()
    const burst = this.bursts.get(name)
    if (!burst || now - burst.at > 250)
      this.bursts.set(name, { at: now, count: 1 })
    else if (++burst.count > 60) {
      if (burst.count === 61)
        console.warn(
          `Field "${name}" keeps changing: its computed value depends on itself. Updates are paused.`,
        )
      return
    }
    this.fields.update((fields) => ({ ...fields, [name]: value }))
  }

  /** Asks the field named `name` to take a value (it applies it and republishes). */
  writeField(name: string, value: unknown): void {
    this.fieldWrites.update((writes) => ({
      ...writes,
      [name]: { value, seq: ++this.writeSeq },
    }))
  }

  /** Simple visibility settings (variable/equals); logic-based visibility lives in block state. */
  isVisible(block: Block): boolean {
    const rule = block.visibility
    if (!rule.variable) return true
    const value = this.value(rule.variable)
    const match = rule.equals ? value === rule.equals : truthy(value)
    return rule.negate ? !match : match
  }

  // -------------------------------------------------------------------------------------------
  // Data sources
  // -------------------------------------------------------------------------------------------

  private collectionKey(id: string): string {
    return `wb-data:${this.project().id}:${id}`
  }

  private useServer(source: DataSource): boolean {
    return !!this.api && source.kind === 'collection' && this.mode() !== 'edit'
  }

  private collectionUrl(sourceId: string): string {
    return `${this.api}/web-builder/runtime/${encodeURIComponent(this.project().id)}/collections/${encodeURIComponent(sourceId)}`
  }

  private initStaticSources(): void {
    const raw = { ...this.raw() }
    const status = { ...this.status() }
    for (const source of this.project().dataSources) {
      if (source.kind === 'rest') continue
      if (this.useServer(source)) {
        status[source.id] = 'loading'
        void this.loadCollectionFromServer(source)
        continue
      }
      const stored =
        source.kind === 'collection' && this.mode() !== 'edit'
          ? storage.get(this.collectionKey(source.id))
          : null
      raw[source.id] = parseRows(stored ?? source.json)
      status[source.id] = 'ready'
    }
    this.raw.set(raw)
    this.status.set(status)
  }

  private async loadCollectionFromServer(source: DataSource): Promise<void> {
    try {
      const rows = (await this.queue.send({
        id: newId(),
        url: this.collectionUrl(source.id),
        method: 'GET',
        headers: {},
        label: source.name,
      })) as { data?: unknown }
      const list = Array.isArray(rows?.data) ? (rows.data as Row[]) : []
      this.raw.update((raw) => ({ ...raw, [source.id]: list }))
      this.setStatus(source.id, 'ready')
    } catch (error) {
      this.setStatus(
        source.id,
        'error',
        error instanceof Error ? error.message : 'Could not load records.',
      )
    }
  }

  private setStatus(id: string, status: SourceStatus, error = ''): void {
    this.status.update((all) => ({ ...all, [id]: status }))
    this.errors.update((all) => ({ ...all, [id]: error }))
  }

  /** Framed rows of a source; re-frames only when its rows or the values its query reads change. */
  private framedSignal(
    sourceId: string,
  ): Signal<{ rows: Row[]; total: number }> {
    let entry = this.framed.get(sourceId)
    if (!entry) {
      const source = computed(() =>
        this.project().dataSources.find((item) => item.id === sourceId),
      )
      const rows = computed(() => this.raw()[sourceId] ?? [])
      const deps = computed(() => {
        const current = source()
        if (!current) return { paths: [], dynamic: false }
        const paths = [
          ...exprPaths(current.query.filter),
          ...templatePaths(current.query.search),
        ]
        // Params inside filters are scope paths too.
        return {
          paths: [...new Set(paths.concat(paramPaths(current)))],
          dynamic: false,
        }
      })
      const framedRows = narrowed(
        this.inputs,
        deps,
        (scope) => {
          const current = source()
          return current
            ? applyFrame(rows(), current, scope as Scope)
            : { rows: [], total: 0 }
        },
        () => [rows(), source()?.query],
      )
      entry = framedRows
      this.framed.set(sourceId, entry)
    }
    return entry
  }

  /** Rows of a source after its framed query (what blocks display). */
  rowsFor(sourceId: string): Row[] {
    const source = this.project().dataSources.find(
      (item) => item.id === sourceId,
    )
    return source ? (this.data().rows[source.name] ?? []) : []
  }

  /** True while a source has never produced data yet (show skeletons) */
  isLoading(sourceId: string): boolean {
    const status = this.status()[sourceId]
    return (
      (status === 'loading' || status === 'idle') &&
      !this.raw()[sourceId]?.length
    )
  }

  /** True while a source with data is refreshing (show a subtle progress indicator). */
  isRefreshing(sourceId: string): boolean {
    return (
      this.status()[sourceId] === 'loading' && !!this.raw()[sourceId]?.length
    )
  }

  /**
   * REST query sources reload automatically when the request they would send changes (URL,
   * params, headers or body built from fields/variables), debounced, latest request wins.
   */
  private watchRestSources(): void {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const intervals = new Map<string, ReturnType<typeof setInterval>>()
    const keys = computed(
      () => {
        const scope = this.inputs()
        const out: Record<string, string> = {}
        for (const source of this.project().dataSources) {
          if (
            source.kind !== 'rest' ||
            source.mode !== 'query' ||
            !source.autoLoad
          )
            continue
          try {
            const request = resolveRequest(source, scope)
            out[source.id] = request ? JSON.stringify(request) : ''
          } catch {
            out[source.id] = ''
          }
        }
        return out
      },
      { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
    )
    const seen = new Map<string, string>()
    effect(() => {
      const current = keys()
      untracked(() => {
        for (const [id, key] of Object.entries(current)) {
          if (seen.get(id) === key) continue
          const first = !seen.has(id)
          seen.set(id, key)
          clearTimeout(timers.get(id))
          // Load immediately the first time; debounce later changes (e.g. typing in a search field).
          timers.set(
            id,
            setTimeout(() => void this.load(id), first ? 0 : 250),
          )
        }
      })
    })
    // Periodic refresh.
    effect(() => {
      const sources = this.project().dataSources.filter(
        (source) =>
          source.kind === 'rest' &&
          source.mode === 'query' &&
          source.refreshSeconds > 0,
      )
      const live = this.mode() !== 'edit'
      untracked(() => {
        for (const timer of intervals.values()) clearInterval(timer)
        intervals.clear()
        if (!live) return
        for (const source of sources)
          intervals.set(
            source.id,
            setInterval(
              () => void this.load(source.id, true),
              Math.max(5, source.refreshSeconds) * 1000,
            ),
          )
      })
    })
    inject(DestroyRef).onDestroy(() => {
      for (const timer of timers.values()) clearTimeout(timer)
      for (const timer of intervals.values()) clearInterval(timer)
    })
  }

  /** (Re)loads a data source. `force` bypasses the response cache. */
  async load(sourceId: string, force = false): Promise<boolean> {
    const source = this.project().dataSources.find(
      (item) => item.id === sourceId,
    )
    if (!source) return false
    if (source.kind === 'collection' && this.useServer(source)) {
      await this.loadCollectionFromServer(source)
      return this.status()[sourceId] === 'ready'
    }
    if (source.kind !== 'rest') {
      this.initStaticSources()
      return true
    }
    if (source.mode === 'mutation') return true
    let request
    try {
      request = resolveRequest(source, this.inputs())
    } catch {
      request = null
    }
    if (!request) {
      this.setStatus(sourceId, 'error', 'The URL or body is not valid.')
      return false
    }
    const cached = force ? undefined : this.queries.peek(request)
    if (cached) this.raw.update((raw) => ({ ...raw, [sourceId]: cached }))
    this.setStatus(sourceId, 'loading')
    try {
      const rows = await this.queries.fetch(
        sourceId,
        request,
        source.path,
        source.cacheSeconds,
        force,
      )
      this.raw.update((raw) => ({ ...raw, [sourceId]: rows }))
      this.setStatus(sourceId, 'ready')
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        return false
      this.setStatus(
        sourceId,
        'error',
        error instanceof Error ? error.message : 'Request failed',
      )
      return false
    }
  }

  private async saveRow(source: DataSource, row: Row): Promise<ActionResult> {
    if (this.useServer(source)) {
      try {
        const result = (await this.queue.send({
          id: String(row['id']),
          url: this.collectionUrl(source.id),
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
          label: source.name,
        })) as { data?: Row; status?: number; message?: string }
        if (result?.message === 'Failed')
          throw new RequestError(
            'The server rejected the record.',
            result.status ?? 400,
          )
        this.raw.update((raw) => ({
          ...raw,
          [source.id]: [...(raw[source.id] ?? []), result?.data ?? row],
        }))
        return done(result?.data ?? row)
      } catch (error) {
        return this.requestFailure(error, 'Could not save.')
      }
    }
    const rows = [...(this.raw()[source.id] ?? []), row]
    this.raw.update((raw) => ({ ...raw, [source.id]: rows }))
    if (this.mode() !== 'edit')
      storage.set(this.collectionKey(source.id), JSON.stringify(rows))
    return done(row)
  }

  /** Runs a project workflow with inputs mapped from the caller's scope; returns its output. */
  private async runWorkflow(
    action: Action,
    scope: Scope,
    context: ActionContext,
  ): Promise<ActionResult> {
    const workflow = (this.project().workflows ?? []).find(
      (item) => item.id === action.target,
    )
    if (!workflow) return failed('Choose a workflow to run.')
    const depth = (context.depth ?? 0) + 1
    if (depth > 8) return failed('Workflows call each other too deeply.')
    const input: Record<string, unknown> = {}
    for (const param of workflow.params) {
      const raw = action.options?.[`in_${param.name}`] ?? ''
      const single = /^\s*\{\{\s*([\w.-]+)\s*\}\}\s*$/.exec(raw)
      input[param.name] =
        raw.trim() === ''
          ? parseParamValue(param.defaultValue)
          : single
            ? readPath(scope, single[1].split('.'))
            : parseParamValue(interpolate(raw, scope))
    }
    const steps: Record<string, unknown> = {}
    const inner: ActionContext = {
      scope: { ...(context.scope ?? {}), input },
      form: context.form ?? null,
      steps,
      depth,
    }
    const outcome = await this.runSteps(workflow.steps, inner, 0)
    if (!outcome.ok) {
      const error = outcome.response as ActionError | undefined
      return {
        ok: false,
        quiet: true,
        error: {
          message: error?.message || `Workflow “${workflow.name}” failed.`,
          status: error?.status ?? 0,
          body: error?.body ?? null,
        },
      }
    }
    if (!workflow.output) return done(outcome.response ?? null)
    try {
      return done(
        compileExpr(workflow.output).evaluator({
          ...this.scope(),
          ...inner.scope,
          steps,
          response: outcome.response ?? null,
        }),
      )
    } catch (error) {
      return failed(
        error instanceof Error
          ? error.message
          : `Workflow “${workflow.name}” produced no output.`,
      )
    }
  }

  /**
   * Changes one field of a row in memory (rows are matched by id, else by identity). Everything
   * that reads the data — tables, totals, bindings — updates at once. Returns the updated row.
   */
  setRowField(
    sourceId: string,
    row: Row,
    field: string,
    value: unknown,
  ): Row | null {
    const rows = this.raw()[sourceId]
    if (!rows || !field) return null
    const id = row['id']
    let index =
      id !== undefined && id !== null
        ? rows.findIndex((item) => this.sameId(item, String(id)))
        : -1
    if (index < 0) index = rows.indexOf(row)
    if (index < 0) return null
    const next: Row = { ...rows[index] }
    const keys = field.split('.')
    let node: Record<string, unknown> = next
    for (const key of keys.slice(0, -1)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype')
        return null
      node[key] =
        node[key] && typeof node[key] === 'object'
          ? { ...(node[key] as Record<string, unknown>) }
          : {}
      node = node[key] as Record<string, unknown>
    }
    const last = keys[keys.length - 1]
    if (last === '__proto__' || last === 'constructor' || last === 'prototype')
      return null
    node[last] = value
    const copy = [...rows]
    copy[index] = next
    this.raw.update((raw) => ({ ...raw, [sourceId]: copy }))
    return next
  }

  /** Saves an edited row field to its record: server/browser collections, or in memory for others. */
  async saveRowField(
    sourceId: string,
    row: Row,
    field: string,
    value: unknown,
  ): Promise<ActionResult> {
    const source = this.project().dataSources.find(
      (item) => item.id === sourceId,
    )
    if (!source) return failed('This table has no data source to save to.')
    if (source.kind === 'rest') return done(row)
    const id = row['id']
    if (id === undefined || id === null || id === '')
      return failed('Rows need an id to be saved.')
    return this.updateRow(source, String(id), { [field]: value })
  }

  private sameId(row: Row, recordId: string): boolean {
    return String(row['id'] ?? '') === recordId
  }

  /** Changes one record of a collection (server collections via PATCH). */
  private async updateRow(
    source: DataSource,
    recordId: string,
    values: Row,
  ): Promise<ActionResult> {
    const current = (this.raw()[source.id] ?? []).find((row) =>
      this.sameId(row, recordId),
    )
    if (!current) return failed('That record no longer exists.')
    const next: Row = {
      ...current,
      ...values,
      id: current['id'],
      updatedAt: new Date().toISOString(),
    }
    if (this.useServer(source)) {
      try {
        const result = (await this.queue.send({
          id: newId(),
          url: `${this.collectionUrl(source.id)}/${encodeURIComponent(recordId)}`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
          label: source.name,
        })) as Row | { data?: Row } | null
        const saved = (
          result && typeof result === 'object' && 'data' in result
            ? (result as { data?: Row }).data
            : result
        ) as Row | null
        Object.assign(next, saved ?? {})
      } catch (error) {
        return this.requestFailure(error, 'Could not update the record.')
      }
    }
    const rows = (this.raw()[source.id] ?? []).map((row) =>
      this.sameId(row, recordId) ? next : row,
    )
    this.raw.update((raw) => ({ ...raw, [source.id]: rows }))
    if (
      source.kind === 'collection' &&
      !this.useServer(source) &&
      this.mode() !== 'edit'
    )
      storage.set(this.collectionKey(source.id), JSON.stringify(rows))
    return done(next)
  }

  /** Removes one record of a collection (server collections via DELETE). */
  private async deleteRow(
    source: DataSource,
    recordId: string,
  ): Promise<ActionResult> {
    const existing = (this.raw()[source.id] ?? []).find((row) =>
      this.sameId(row, recordId),
    )
    if (!existing) return failed('That record no longer exists.')
    if (this.useServer(source)) {
      try {
        await this.queue.send({
          id: newId(),
          url: `${this.collectionUrl(source.id)}/${encodeURIComponent(recordId)}`,
          method: 'DELETE',
          headers: {},
          label: source.name,
        })
      } catch (error) {
        return this.requestFailure(error, 'Could not delete the record.')
      }
    }
    const rows = (this.raw()[source.id] ?? []).filter(
      (row) => !this.sameId(row, recordId),
    )
    this.raw.update((raw) => ({ ...raw, [source.id]: rows }))
    if (
      source.kind === 'collection' &&
      !this.useServer(source) &&
      this.mode() !== 'edit'
    )
      storage.set(this.collectionKey(source.id), JSON.stringify(rows))
    return done(existing)
  }

  /** Converts a thrown request error into a failed result (keeping status and body). */
  private requestFailure(error: unknown, fallback: string): ActionResult {
    if (error instanceof RequestError)
      return failed(error.message || fallback, error.status, error.body)
    return failed(
      error instanceof Error && error.message ? error.message : fallback,
    )
  }

  private async clearCollection(sourceId: string): Promise<ActionResult> {
    const source = this.project().dataSources.find(
      (item) => item.id === sourceId,
    )
    if (!source) return failed('Choose a collection to clear.')
    if (this.useServer(source)) {
      try {
        await this.queue.send({
          id: newId(),
          url: this.collectionUrl(source.id),
          method: 'DELETE',
          headers: {},
          label: source.name,
        })
      } catch (error) {
        return this.requestFailure(error, 'Could not clear the records.')
      }
    } else if (this.mode() !== 'edit')
      storage.set(this.collectionKey(sourceId), '[]')
    this.raw.update((raw) => ({ ...raw, [sourceId]: [] }))
    return done([])
  }

  // -------------------------------------------------------------------------------------------
  // Block logic and page rules
  // -------------------------------------------------------------------------------------------

  /** All scope paths a block's bindings read. */
  static logicPaths(logic: BlockLogic): { paths: string[]; dynamic: boolean } {
    const exprs: Expr[] = []
    for (const key of [
      'visible',
      'enabled',
      'required',
      'value',
      'options',
    ] as const)
      if (logic[key]) exprs.push(logic[key]!)
    for (const expr of Object.values(logic.props ?? {})) exprs.push(expr)
    let dynamic = false
    const paths = new Set<string>()
    for (const expr of exprs) {
      try {
        const compiled = compileExpr(expr)
        compiled.paths.forEach((path) => paths.add(path))
        dynamic ||= compiled.dynamic
      } catch {
        /* invalid expressions evaluate to their fallback */
      }
    }
    return { paths: [...paths], dynamic }
  }

  private rulesDependencies(): { paths: string[]; dynamic: boolean } {
    const paths = new Set<string>()
    let dynamic = false
    for (const rule of this.page().rules) {
      if (!rule.enabled) continue
      for (const expr of [
        rule.when,
        ...[...rule.effects, ...rule.otherwise].map((effect) => effect.value),
      ]) {
        if (!expr) continue
        try {
          const compiled = compileExpr(expr)
          compiled.paths.forEach((path) => paths.add(path))
          dynamic ||= compiled.dynamic
        } catch {
          /* ignore */
        }
      }
    }
    return { paths: [...paths], dynamic }
  }

  private evaluateRules(
    rules: PageRule[],
    scope: unknown,
  ): Map<string, Overlay> {
    if (!rules.length) return EMPTY_OVERLAYS
    const overlays = new Map<string, Overlay>()
    const apply = (effects: PageRule['effects']) => {
      for (const effect of effects) {
        const overlay = overlays.get(effect.target) ?? {}
        switch (effect.kind) {
          case 'show':
            overlay.visible = true
            break
          case 'hide':
            overlay.visible = false
            break
          case 'enable':
            overlay.enabled = true
            break
          case 'disable':
            overlay.enabled = false
            break
          case 'require':
            overlay.required = true
            break
          case 'optional':
            overlay.required = false
            break
          case 'set-prop':
            if (effect.prop)
              overlay.props = {
                ...overlay.props,
                [effect.prop]: evaluateExpr(effect.value, scope, null),
              }
            break
          case 'set-value':
            continue
        }
        overlays.set(effect.target, overlay)
      }
    }
    for (const rule of rules) {
      if (!rule.enabled) continue
      apply(
        logicTruthy(evaluateExpr(rule.when, scope, false))
          ? rule.effects
          : rule.otherwise,
      )
    }
    return overlays
  }

  /** `set-value` effects run once each time their rule's condition flips. */
  private watchRuleTransitions(): void {
    const states = computed(
      () => {
        const scope = this.scope()
        return this.page().rules.map(
          (rule) =>
            [
              rule.id,
              rule.enabled &&
                logicTruthy(evaluateExpr(rule.when, scope, false)),
            ] as const,
        )
      },
      { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
    )
    const previous = new Map<string, boolean>()
    effect(() => {
      const current = states()
      if (this.mode() === 'edit') return
      untracked(() => {
        const scope = this.scope()
        for (const [id, active] of current) {
          const before = previous.get(id)
          previous.set(id, active)
          if (before === undefined || before === active) continue
          const rule = this.page().rules.find((item) => item.id === id)
          for (const effect of (active ? rule?.effects : rule?.otherwise) ??
            []) {
            if (effect.kind !== 'set-value') continue
            const target = findBlock(this.page().blocks, effect.target)
            if (target && isFormField(target.type))
              this.writeField(
                fieldName(target),
                evaluateExpr(effect.value, scope, null),
              )
          }
        }
      })
    })
  }

  /** Field names available on the current page (for the studio's pickers). */
  fieldNames(): string[] {
    return [
      ...new Set(
        flatten(this.page().blocks)
          .map((layer) => layer.block)
          .filter((block) => isFormField(block.type))
          .map(fieldName),
      ),
    ]
  }

  // -------------------------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------------------------

  message(text: string): void {
    this.notify({ message: text })
  }

  /** Shows a themed toast notification. */
  notify(options: NotifyOptions): void {
    const severity = options.severity ?? 'info'
    const [vertical, horizontal] = (options.position || 'bottom-center').split(
      '-',
    ) as [MatSnackBarVerticalPosition, MatSnackBarHorizontalPosition]
    const seconds = options.duration ?? (severity === 'error' ? 6 : 4)
    this.snack.openFromComponent<NotificationToast, NotificationData>(
      NotificationToast,
      {
        data: {
          severity,
          title: options.title ?? '',
          message: options.message,
          actionLabel: options.actionLabel ?? '',
        },
        duration: seconds > 0 ? seconds * 1000 : undefined,
        verticalPosition: vertical === 'top' ? 'top' : 'bottom',
        horizontalPosition: [
          'start',
          'end',
          'left',
          'right',
          'center',
        ].includes(horizontal)
          ? horizontal
          : 'center',
        panelClass: [
          'wb-toast',
          `wb-toast-${severity}`,
          ...this.themeClasses().split(' '),
        ],
        politeness:
          severity === 'error' || severity === 'warning'
            ? 'assertive'
            : 'polite',
      },
    )
  }

  /** Runs the actions bound to `trigger` in order. Returns false if one of them failed. */
  async run(
    actions: readonly Action[],
    trigger: Trigger,
    context: ActionContext,
  ): Promise<boolean> {
    if (this.mode() === 'edit') return true
    const steps = actions.filter((action) => action.trigger === trigger)
    if (!steps.length) return true
    return (
      await this.runSteps(steps, { ...context, steps: context.steps ?? {} }, 0)
    ).ok
  }

  /**
   * Runs steps in order. After a step succeeds its `onSuccess` steps run with `{{response}}`;
   * when it fails its `onError` steps run with `{{error}}` (or an error notification is shown)
   * and the chain stops, unless the step is set to continue on error.
   */
  private async runSteps(
    steps: readonly Action[],
    context: ActionContext,
    depth: number,
  ): Promise<StepsOutcome> {
    if (depth > 6) return { ok: false }
    let last: unknown = null
    for (const action of steps) {
      const scope = this.actionScope(context)
      if (action.when && !logicTruthy(evaluateExpr(action.when, scope, false)))
        continue
      let result: ActionResult
      try {
        result = await this.execute(action, context)
      } catch (error) {
        result = this.requestFailure(error, 'Something went wrong.')
      }
      if (result.ok) {
        last = result.response ?? null
        const saveAs = action.options?.['saveAs']
        if (saveAs && context.steps) context.steps[saveAs] = last
        if (action.onSuccess?.length) {
          const nested = await this.runSteps(
            action.onSuccess,
            { ...context, scope: { ...context.scope, response: last } },
            depth + 1,
          )
          if (!nested.ok) return { ok: false }
          if (nested.response !== undefined && nested.response !== null)
            last = nested.response
        }
        continue
      }
      const error = result.error ?? {
        message: 'Something went wrong.',
        status: 0,
        body: null,
      }
      // Field errors from the server are shown on the matching fields of the form.
      let matchedFields = 0
      if (context.form && error.body) {
        const parsed = parseServerErrors(error.body)
        matchedFields = context.form.setServerErrors(parsed.fields)
      }
      if (action.onError?.length) {
        await this.runSteps(
          action.onError,
          { ...context, scope: { ...context.scope, error } },
          depth + 1,
        )
      } else if (!result.quiet) {
        this.notify({
          severity: 'error',
          message: matchedFields
            ? `${error.message} Check the highlighted fields.`
            : error.message,
        })
      }
      if (action.options?.['continueOnError'] !== 'true')
        return { ok: false, response: error }
    }
    return { ok: true, response: last }
  }

  hasActions(actions: readonly Action[], trigger: Trigger): boolean {
    return actions.some((action) => action.trigger === trigger)
  }

  private actionScope(context: ActionContext): Scope {
    const base = {
      ...this.scope(),
      ...context.scope,
      steps: context.steps ?? {},
    }
    return context.form ? { ...base, form: context.form.values() } : base
  }

  private async execute(
    action: Action,
    context: ActionContext,
  ): Promise<ActionResult> {
    const scope = this.actionScope(context)
    const text = (value: string) => interpolate(value, scope)
    const options = action.options ?? {}
    switch (action.type) {
      case 'navigate': {
        if (!this.project().pages.some((page) => page.id === action.target))
          return failed('That page no longer exists.')
        this.navigateHandler(action.target)
        return done()
      }
      case 'openUrl': {
        const url = safeUrl(text(action.target))
        if (!url) return failed('This link is not allowed.')
        if (url.startsWith('#')) {
          this.scrollToAnchor(url.slice(1))
          return done()
        }
        this.document.defaultView?.open(
          url,
          action.value === 'same' ? '_self' : '_blank',
          'noopener',
        )
        return done()
      }
      case 'showMessage':
        this.notify({
          message: text(action.value),
          severity: (['info', 'success', 'warning', 'error'].includes(
            options['severity'],
          )
            ? options['severity']
            : 'info') as NotificationSeverity,
          title: text(options['title'] ?? ''),
          duration:
            options['duration'] === undefined || options['duration'] === ''
              ? undefined
              : Number(options['duration']),
          position: options['position'],
          actionLabel: options['actionLabel'],
        })
        return done()
      case 'confirm': {
        const confirmed = await this.confirmService.confirm({
          title: text(options['title'] || 'Are you sure?'),
          message: text(action.value),
          confirmText: options['confirmLabel'] || 'Confirm',
          cancelText: options['cancelLabel'] || 'Cancel',
          destructive: options['danger'] === 'true',
          panelClass: ['wb-confirm-panel', ...this.themeClasses().split(' ')],
        })
        return confirmed
          ? done(true)
          : {
              ok: false,
              quiet: true,
              error: { message: 'Cancelled', status: 0, body: null },
            }
      }
      case 'openDialog':
        return this.openDialog(action.target, scope)
          ? done()
          : failed('That dialog is not on this page.')
      case 'closeDialog':
        this.dialog.openDialogs.at(-1)?.close()
        return done()
      case 'setVariable':
        this.setValue(action.target, text(action.value))
        return done()
      case 'toggleVariable':
        this.setValue(
          action.target,
          truthy(this.value(action.target)) ? 'false' : 'true',
        )
        return done()
      case 'incrementVariable': {
        const amount = Number(text(action.value || '1'))
        this.setValue(
          action.target,
          String(
            (Number(this.value(action.target)) || 0) +
              (Number.isFinite(amount) ? amount : 1),
          ),
        )
        return done()
      }
      case 'setField': {
        const single = /^\s*\{\{\s*([\w.-]+)\s*\}\}\s*$/.exec(action.value)
        this.writeField(
          action.target,
          single ? readPath(scope, single[1].split('.')) : text(action.value),
        )
        return done()
      }
      case 'submitForm':
        return this.submit(action, scope, context)
      case 'callApi':
        return this.callApi(action.target, scope)
      case 'saveToCollection': {
        if (!context.form) return done()
        const source = this.project().dataSources.find(
          (item) => item.id === action.target && item.kind === 'collection',
        )
        if (!source) return failed('Choose a collection for this form.')
        return this.saveRow(source, {
          id: newId(),
          ...context.form.values(),
          createdAt: new Date().toISOString(),
        })
      }
      case 'clearCollection':
        return this.clearCollection(action.target)
      case 'refreshData': {
        const ok = await this.load(action.target, true)
        return ok
          ? done(this.rowsFor(action.target))
          : failed(this.errors()[action.target] || 'Could not load the data.')
      }
      case 'resetForm':
        context.form?.reset()
        return done()
      case 'scrollTo': {
        const element = this.document.querySelector(
          `.wb-el-${CSS.escape(action.target)}`,
        )
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return done()
      }
      case 'copyText': {
        const value = text(action.value)
        try {
          await this.document.defaultView?.navigator.clipboard.writeText(value)
          return done(value)
        } catch {
          return failed('Copying is not allowed here.')
        }
      }
      case 'updateRecord':
      case 'deleteRecord': {
        const source = this.project().dataSources.find(
          (item) => item.id === action.target && item.kind !== 'rest',
        )
        if (!source) return failed('Choose a collection for this action.')
        const recordId = text(action.value || '{{row.id}}').trim()
        if (!recordId) return failed('This row has no id.')
        if (action.type === 'deleteRecord')
          return this.deleteRow(source, recordId)
        if (!context.form)
          return failed(
            'Put “Update record” on a form’s submit so the new values come from its fields.',
          )
        return this.updateRow(source, recordId, context.form.values())
      }
      case 'compute': {
        if (!action.expr) return done(null)
        try {
          return done(compileExpr(action.expr).evaluator(scope))
        } catch (error) {
          return failed(
            error instanceof Error ? error.message : 'The calculation failed.',
          )
        }
      }
      case 'parallel': {
        const branches = action.branches ?? []
        // Every branch starts at once; each runs its own steps in order. Saved results are shared.
        const outcomes = await Promise.all(
          branches.map((branch) => this.runSteps(branch, { ...context }, 1)),
        )
        const responses = outcomes.map((outcome) => outcome.response ?? null)
        if (
          options['mode'] !== 'settled' &&
          outcomes.some((outcome) => !outcome.ok)
        )
          return {
            ok: false,
            quiet: true,
            error: {
              message: 'A parallel branch failed.',
              status: 0,
              body: responses,
            },
          }
        return done(responses)
      }
      case 'runWorkflow':
        return this.runWorkflow(action, scope, context)
      case 'goBack':
        this.document.defaultView?.history.back()
        return done()
      case 'wait': {
        const ms = Math.min(
          Math.max(Number(text(action.value)) || 0, 0),
          30_000,
        )
        await new Promise((resolve) => setTimeout(resolve, ms))
        return done()
      }
    }
  }

  private scrollToAnchor(anchor: string): boolean {
    this.document
      .getElementById(anchor)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return true
  }

  /** Sends a mutation data source through the request queue (retries, offline outbox). */
  private async callApi(sourceId: string, scope: Scope): Promise<ActionResult> {
    const source = this.project().dataSources.find(
      (item) => item.id === sourceId,
    )
    if (!source || source.kind !== 'rest')
      return failed('Choose an API endpoint for this action.')
    let request
    try {
      request = resolveRequest(source, scope)
    } catch {
      request = null
    }
    if (!request) return failed('The endpoint URL or body is not valid.')
    try {
      const response = await this.queue.send({
        id: newId(),
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
        label: source.name,
      })
      this.queries.invalidate()
      return done(response)
    } catch (error) {
      return this.requestFailure(error, 'The request failed.')
    }
  }

  private async submit(
    action: Action,
    scope: Scope,
    context: ActionContext,
  ): Promise<ActionResult> {
    if (!context.form) return done()
    const endpoint = safeEndpoint(interpolate(action.target, scope))
    if (!endpoint)
      return failed('Form endpoints must use https or a same-site path.')
    try {
      const response = await this.queue.send({
        id: newId(),
        url: endpoint,
        method: action.value === 'PUT' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context.form.values()),
        label: 'form',
      })
      return done(response)
    } catch (error) {
      return this.requestFailure(
        error,
        'Sorry, the form could not be sent. Please try again.',
      )
    }
  }

  private openDialog(blockId: string, scope: Scope): boolean {
    const block = findBlock(this.page().blocks, blockId)
    if (!block || block.type !== 'dialog' || !DIALOG_HOST.component)
      return false
    const size = String(block.props['size'] || 'md')
    const presentation = String(block.props['presentation'] || 'dialog')
    const widths: Record<string, Record<string, string>> = {
      dialog: { sm: '420px', md: '560px', lg: '800px' },
      side: { sm: '360px', md: '480px', lg: '640px' },
      bottom: { sm: '560px', md: '720px', lg: '960px' },
    }
    const config =
      presentation === 'side'
        ? {
            width: widths['side'][size] ?? '480px',
            maxWidth: '100vw',
            height: '100dvh',
            position: { right: '0', top: '0' },
          }
        : presentation === 'bottom'
          ? {
              width: widths['bottom'][size] ?? '720px',
              maxWidth: '100vw',
              maxHeight: '85dvh',
              position: { bottom: '0' },
            }
          : presentation === 'fullscreen'
            ? { width: '100vw', maxWidth: '100vw', height: '100dvh' }
            : {
                width: widths['dialog'][size] ?? '560px',
                maxWidth: 'calc(100vw - 32px)',
              }
    this.dialog.open(DIALOG_HOST.component, {
      data: { block, scope },
      injector: this.injector,
      panelClass: [
        'wb-dialog-panel',
        `wb-dialog-${presentation}`,
        ...this.themeClasses().split(' '),
      ],
      ...config,
      disableClose: block.props['dismissible'] === false,
      autoFocus: 'first-tabbable',
      ariaLabel: String(block.props['title'] ?? ''),
    })
    return true
  }
}

const TEMPLATE_PATH = /\{\{\s*([a-zA-Z_][\w]*(?:\.[\w-]+)*)\s*\}\}/g

function templatePaths(text: string): string[] {
  return [...text.matchAll(TEMPLATE_PATH)].map((match) => match[1])
}

function paramPaths(source: DataSource): string[] {
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      const keys = Object.keys(record)
      if (keys.length === 1 && keys[0] === 'param')
        out.push(String(record['param']))
      else keys.forEach((key) => walk(record[key]))
    }
  }
  if (source.query.filter?.kind === 'rule') walk(source.query.filter.rule)
  if (source.query.filter?.kind === 'conditions') {
    const visit = (group: { conditions: unknown[] }): void => {
      for (const item of group.conditions) {
        const condition = item as Record<string, unknown>
        if ('combinator' in condition)
          visit(condition as { conditions: unknown[] })
        else if (condition['source'] === 'param')
          out.push(
            String(condition['value'] ?? ''),
            String(condition['value2'] ?? ''),
          )
      }
    }
    visit(source.query.filter.group)
  }
  return out.filter(Boolean)
}

/** Interpolation helper kept for templates in actions and bodies. */
export { interpolateJson }
