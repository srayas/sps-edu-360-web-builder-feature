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
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatDialog } from '@angular/material/dialog'
import { readPath, truthy as logicTruthy } from '@spsedu360/json-logic'
import {
  Action,
  Block,
  BlockLogic,
  DataSource,
  Expr,
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
import { narrowed } from './narrow'

export type RuntimeMode = 'edit' | 'preview' | 'live'
export type Row = Record<string, unknown>
export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ActionContext {
  scope: Scope
  form?: FormScope | null
}

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
  readonly scope = computed<Scope>(() => {
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

  private async saveRow(source: DataSource, row: Row): Promise<boolean> {
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
        return true
      } catch (error) {
        this.message(error instanceof Error ? error.message : 'Could not save.')
        return false
      }
    }
    const rows = [...(this.raw()[source.id] ?? []), row]
    this.raw.update((raw) => ({ ...raw, [source.id]: rows }))
    if (this.mode() !== 'edit')
      storage.set(this.collectionKey(source.id), JSON.stringify(rows))
    return true
  }

  private async clearCollection(sourceId: string): Promise<boolean> {
    const source = this.project().dataSources.find(
      (item) => item.id === sourceId,
    )
    if (!source) return false
    if (this.useServer(source)) {
      try {
        await this.queue.send({
          id: newId(),
          url: this.collectionUrl(source.id),
          method: 'DELETE',
          headers: {},
          label: source.name,
        })
      } catch {
        this.message('Could not clear the records.')
        return false
      }
    } else if (this.mode() !== 'edit')
      storage.set(this.collectionKey(sourceId), '[]')
    this.raw.update((raw) => ({ ...raw, [sourceId]: [] }))
    return true
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
    this.snack.open(text, 'Close', {
      duration: 4000,
      panelClass: this.themeClasses().split(' '),
    })
  }

  /** Runs the actions bound to `trigger` in order. Returns false if one of them failed. */
  async run(
    actions: readonly Action[],
    trigger: Trigger,
    context: ActionContext,
  ): Promise<boolean> {
    if (this.mode() === 'edit') return true
    for (const action of actions) {
      if (action.trigger !== trigger) continue
      const scope = this.actionScope(context)
      if (action.when && !logicTruthy(evaluateExpr(action.when, scope, false)))
        continue
      const ok = await this.execute(action, context)
      if (!ok) return false
    }
    return true
  }

  hasActions(actions: readonly Action[], trigger: Trigger): boolean {
    return actions.some((action) => action.trigger === trigger)
  }

  private actionScope(context: ActionContext): Scope {
    const base = { ...this.scope(), ...context.scope }
    return context.form ? { ...base, form: context.form.values() } : base
  }

  private async execute(
    action: Action,
    context: ActionContext,
  ): Promise<boolean> {
    const scope = this.actionScope(context)
    const text = (value: string) => interpolate(value, scope)
    switch (action.type) {
      case 'navigate': {
        if (!this.project().pages.some((page) => page.id === action.target)) {
          this.message('That page no longer exists.')
          return false
        }
        this.navigateHandler(action.target)
        return true
      }
      case 'openUrl': {
        const url = safeUrl(text(action.target))
        if (!url) {
          this.message('This link is not allowed.')
          return false
        }
        if (url.startsWith('#')) return this.scrollToAnchor(url.slice(1))
        this.document.defaultView?.open(
          url,
          action.value === 'same' ? '_self' : '_blank',
          'noopener',
        )
        return true
      }
      case 'showMessage':
        this.message(text(action.value))
        return true
      case 'openDialog':
        return this.openDialog(action.target, scope)
      case 'closeDialog':
        this.dialog.openDialogs.at(-1)?.close()
        return true
      case 'setVariable':
        this.setValue(action.target, text(action.value))
        return true
      case 'toggleVariable':
        this.setValue(
          action.target,
          truthy(this.value(action.target)) ? 'false' : 'true',
        )
        return true
      case 'incrementVariable': {
        const amount = Number(text(action.value || '1'))
        this.setValue(
          action.target,
          String(
            (Number(this.value(action.target)) || 0) +
              (Number.isFinite(amount) ? amount : 1),
          ),
        )
        return true
      }
      case 'setField': {
        const single = /^\s*\{\{\s*([\w.-]+)\s*\}\}\s*$/.exec(action.value)
        this.writeField(
          action.target,
          single ? readPath(scope, single[1].split('.')) : text(action.value),
        )
        return true
      }
      case 'submitForm':
        return this.submit(action, scope, context)
      case 'callApi':
        return this.callApi(action.target, scope)
      case 'saveToCollection': {
        if (!context.form) return true
        const source = this.project().dataSources.find(
          (item) => item.id === action.target && item.kind === 'collection',
        )
        if (!source) {
          this.message('Choose a collection for this form.')
          return false
        }
        return this.saveRow(source, {
          id: newId(),
          ...context.form.values(),
          createdAt: new Date().toISOString(),
        })
      }
      case 'clearCollection':
        return this.clearCollection(action.target)
      case 'refreshData':
        return this.load(action.target, true)
      case 'resetForm':
        context.form?.reset()
        return true
      case 'scrollTo': {
        const element = this.document.querySelector(
          `.wb-el-${CSS.escape(action.target)}`,
        )
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return true
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
  private async callApi(sourceId: string, scope: Scope): Promise<boolean> {
    const source = this.project().dataSources.find(
      (item) => item.id === sourceId,
    )
    if (!source || source.kind !== 'rest') {
      this.message('Choose an API endpoint for this action.')
      return false
    }
    let request
    try {
      request = resolveRequest(source, scope)
    } catch {
      request = null
    }
    if (!request) {
      this.message('The endpoint URL or body is not valid.')
      return false
    }
    try {
      await this.queue.send({
        id: newId(),
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
        label: source.name,
      })
      this.queries.invalidate()
      return true
    } catch (error) {
      this.message(
        error instanceof Error ? error.message : 'The request failed.',
      )
      return false
    }
  }

  private async submit(
    action: Action,
    scope: Scope,
    context: ActionContext,
  ): Promise<boolean> {
    if (!context.form) return true
    const endpoint = safeEndpoint(interpolate(action.target, scope))
    if (!endpoint) {
      this.message('Form endpoints must use https or a same-site path.')
      return false
    }
    try {
      await this.queue.send({
        id: newId(),
        url: endpoint,
        method: action.value === 'PUT' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context.form.values()),
        label: 'form',
      })
      return true
    } catch (error) {
      this.message(
        error instanceof RequestError && error.message
          ? error.message
          : 'Sorry, the form could not be sent. Please try again.',
      )
      return false
    }
  }

  private openDialog(blockId: string, scope: Scope): boolean {
    const block = findBlock(this.page().blocks, blockId)
    if (!block || block.type !== 'dialog' || !DIALOG_HOST.component) {
      this.message('That dialog is not on this page.')
      return false
    }
    const width =
      { sm: '420px', md: '560px', lg: '800px' }[String(block.props['size'])] ??
      '560px'
    this.dialog.open(DIALOG_HOST.component, {
      data: { block, scope },
      injector: this.injector,
      panelClass: ['wb-dialog-panel', ...this.themeClasses().split(' ')],
      width,
      maxWidth: 'calc(100vw - 32px)',
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
