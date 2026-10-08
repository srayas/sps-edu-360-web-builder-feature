import { Injectable, computed, inject, signal } from '@angular/core'
import {
  Action,
  Block,
  DataSource,
  Page,
  Project,
  Props,
  StyleScope,
  Template,
  ThemeSettings,
  ShellSettings,
  Variable,
  Viewport,
  canContain,
  createAction,
  createBlock,
  createPage,
  createProject,
  definition,
  duplicateBlock,
  findBlock,
  findParent,
  flatten,
  insertBlock,
  instantiate,
  mergeTemplateData,
  createSource,
  moveBlock,
  newId,
  removeBlock,
  slugify,
  uniqueSlug,
  uniqueVariableName,
  LIMITS,
  countBlocks,
  Trigger,
  BlockLogic,
  Expr,
  PageRule,
  RuleEffect,
  createRule,
} from '../../core/model'
import { ProjectRepository } from '../../core/persistence/project-repository'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

/**
 * Studio state for one open project. Every mutation goes through `change`, which records undo
 * history (coalescing rapid edits such as typing) and schedules an autosave.
 */
@Injectable()
export class BuilderStore {
  private readonly repository = inject(ProjectRepository)

  readonly project = signal<Project>(createProject())
  readonly pageId = signal('')
  readonly selectedId = signal('')
  readonly viewport = signal<Viewport>('desktop')
  readonly preview = signal(false)
  readonly saveState = signal<SaveState>('saved')
  readonly saveError = signal('')
  readonly history = signal<Project[]>([])
  readonly future = signal<Project[]>([])
  readonly clipboard = signal<Block | null>(null)

  readonly page = computed<Page>(
    () =>
      this.project().pages.find((page) => page.id === this.pageId()) ??
      this.project().pages[0],
  )
  readonly selected = computed(() =>
    findBlock(this.page().blocks, this.selectedId()),
  )
  readonly layers = computed(() => flatten(this.page().blocks))
  readonly selectedPath = computed(() => {
    const path: Block[] = []
    let id = this.selectedId()
    while (id) {
      const block = findBlock(this.page().blocks, id)
      if (!block) break
      path.unshift(block)
      const parent = findParent(this.page().blocks, id)
      id = parent && parent !== 'root' ? parent.id : ''
    }
    return path
  })
  readonly dialogs = computed(() =>
    this.layers()
      .map((layer) => layer.block)
      .filter((block) => block.type === 'dialog'),
  )

  private lastCoalesce = { key: '', at: 0 }
  private saveTimer: ReturnType<typeof setTimeout> | undefined

  load(project: Project): void {
    this.project.set(project)
    this.pageId.set(project.pages[0].id)
    this.selectedId.set('')
    this.history.set([])
    this.future.set([])
    this.saveState.set('saved')
  }

  /**
   * Applies a mutation to a draft copy. `coalesce` merges consecutive edits with the same key
   * (e.g. keystrokes in one field) into a single undo step.
   */
  change(update: (project: Project) => void | boolean, coalesce = ''): boolean {
    const current = this.project()
    const next = structuredClone(current)
    const result = update(next)
    if (result === false) return false
    // Mutations that report `true` changed something; only ambiguous ones pay for a deep compare.
    if (result !== true && JSON.stringify(next) === JSON.stringify(current))
      return false
    const now = Date.now()
    const merge =
      !!coalesce &&
      coalesce === this.lastCoalesce.key &&
      now - this.lastCoalesce.at < 1200
    this.lastCoalesce = { key: coalesce, at: now }
    if (!merge)
      this.history.update((history) => [...history.slice(-79), current])
    this.future.set([])
    this.project.set(next)
    this.markDirty()
    return true
  }

  private draftPage(project: Project): Page {
    return (
      project.pages.find((page) => page.id === this.pageId()) ??
      project.pages[0]
    )
  }

  // -------------------------------------------------------------------------------------------
  // Blocks
  // -------------------------------------------------------------------------------------------

  add(
    type: string,
    parentId = 'root',
    index?: number,
    props: Props = {},
  ): Block | null {
    if (countBlocks(this.page().blocks) >= LIMITS.blocks) return null
    const block = createBlock(type, props)
    const ok = this.change((project) =>
      insertBlock(this.draftPage(project).blocks, block, parentId, index),
    )
    if (ok) this.selectedId.set(block.id)
    return ok ? block : null
  }

  /** Adds where it makes sense relative to the selection: inside a selected container, else after the selection. */
  addSmart(type: string): Block | null {
    const selected = this.selected()
    if (selected && canContain(selected.type, type))
      return this.add(type, selected.id)
    if (selected) {
      const parent = findParent(this.page().blocks, selected.id)
      const parentId = parent && parent !== 'root' ? parent.id : 'root'
      const siblings =
        parent && parent !== 'root' ? parent.children : this.page().blocks
      if (canContain(parent && parent !== 'root' ? parent.type : 'root', type))
        return this.add(
          type,
          parentId,
          siblings.findIndex((block) => block.id === selected.id) + 1,
        )
    }
    return this.add(type, 'root')
  }

  move(id: string, parentId: string, index: number): boolean {
    return this.change((project) =>
      moveBlock(this.draftPage(project).blocks, id, parentId, index),
    )
  }

  canPlace(type: string, parentId: string): boolean {
    if (parentId === 'root') return canContain('root', type)
    const parent = findBlock(this.page().blocks, parentId)
    return !!parent && canContain(parent.type, type)
  }

  insertTemplate(
    template: Template,
    parentId = 'root',
    index?: number,
  ): boolean {
    let firstId = ''
    const ok = this.change((project) => {
      const refs = mergeTemplateData(project, template)
      const blocks = instantiate(template.blocks, refs)
      const page = this.draftPage(project)
      if (countBlocks(page.blocks) + countBlocks(blocks) > LIMITS.blocks)
        return false
      let at = index
      for (const block of blocks) {
        if (!insertBlock(page.blocks, block, parentId, at)) return false
        if (at !== undefined) at++
      }
      firstId = blocks[0]?.id ?? ''
      return true
    })
    if (ok) this.selectedId.set(firstId)
    return ok
  }

  /** Creates a new page from a page template (or a blank page). */
  addPage(template?: Template): void {
    if (this.project().pages.length >= LIMITS.pages) return
    const id = newId()
    this.change((project) => {
      const name =
        template && template.id !== 'blank'
          ? template.name.replace(/ page$/i, '')
          : `Page ${project.pages.length + 1}`
      const page = createPage(name, uniqueSlug(project, name))
      page.id = id
      if (template)
        page.blocks = instantiate(
          template.blocks,
          mergeTemplateData(project, template),
        )
      project.pages.push(page)
    })
    this.pageId.set(id)
    this.selectedId.set('')
  }

  updateProps(patch: Props, coalesce = ''): void {
    const id = this.selectedId()
    this.change(
      (project) => {
        const block = findBlock(this.draftPage(project).blocks, id)
        if (!block) return false
        block.props = { ...block.props, ...patch }
        return true
      },
      coalesce && `${id}:${coalesce}`,
    )
  }

  rename(name: string): void {
    const id = this.selectedId()
    this.change((project) => {
      const block = findBlock(this.draftPage(project).blocks, id)
      if (!block) return false
      block.name = name.slice(0, 120)
      return true
    }, `${id}:name`)
  }

  setStyle(scope: StyleScope, property: string, value: string): void {
    const id = this.selectedId()
    this.change((project) => {
      const block = findBlock(this.draftPage(project).blocks, id)
      if (!block) return false
      const styles = { ...block[scope] }
      if (value.trim()) styles[property] = value.trim()
      else delete styles[property]
      block[scope] = styles
      return true
    }, `${id}:${scope}:${property}`)
  }

  resetStyles(scope?: StyleScope): void {
    const id = this.selectedId()
    this.change((project) => {
      const block = findBlock(this.draftPage(project).blocks, id)
      if (!block) return false
      for (const key of scope
        ? [scope]
        : (['styles', 'tabletStyles', 'mobileStyles'] as const))
        block[key] = {}
      return true
    })
  }

  updateVisibility(patch: Partial<Block['visibility']>): void {
    const id = this.selectedId()
    this.change((project) => {
      const block = findBlock(this.draftPage(project).blocks, id)
      if (!block) return false
      block.visibility = { ...block.visibility, ...patch }
      return true
    }, `${id}:visibility`)
  }

  addAction(trigger: Trigger, type: Action['type']): void {
    const id = this.selectedId()
    this.change((project) => {
      const owner = id
        ? findBlock(this.draftPage(project).blocks, id)
        : this.draftPage(project)
      if (!owner || owner.actions.length >= LIMITS.actions) return false
      owner.actions.push(
        createAction(
          trigger,
          type,
          '',
          type === 'submitForm'
            ? 'POST'
            : type === 'incrementVariable'
              ? '1'
              : '',
        ),
      )
      return true
    })
  }

  updateAction(
    actionId: string,
    patch: Partial<Action>,
    pageLevel = false,
  ): void {
    const id = this.selectedId()
    this.change((project) => {
      const owner = pageLevel
        ? this.draftPage(project)
        : findBlock(this.draftPage(project).blocks, id)
      const action = owner?.actions.find((item) => item.id === actionId)
      if (!action) return false
      Object.assign(action, patch)
      return true
    }, `${actionId}:edit`)
  }

  removeAction(actionId: string, pageLevel = false): void {
    const id = this.selectedId()
    this.change((project) => {
      const owner = pageLevel
        ? this.draftPage(project)
        : findBlock(this.draftPage(project).blocks, id)
      if (!owner) return false
      owner.actions = owner.actions.filter((item) => item.id !== actionId)
      return true
    })
  }

  moveAction(actionId: string, delta: number, pageLevel = false): void {
    const id = this.selectedId()
    this.change((project) => {
      const owner = pageLevel
        ? this.draftPage(project)
        : findBlock(this.draftPage(project).blocks, id)
      if (!owner) return false
      const index = owner.actions.findIndex((item) => item.id === actionId)
      const target = index + delta
      if (index < 0 || target < 0 || target >= owner.actions.length)
        return false
      ;[owner.actions[index], owner.actions[target]] = [
        owner.actions[target],
        owner.actions[index],
      ]
      return true
    })
  }

  // ----- Reactive logic -------------------------------------------------------------------------

  /** Sets or clears one of the selected block's bindings (visible, enabled, required, value, options). */
  setLogic(
    key: Exclude<keyof BlockLogic, 'props'>,
    expr: Expr | undefined,
  ): void {
    const id = this.selectedId()
    this.change((project) => {
      const block = findBlock(this.draftPage(project).blocks, id)
      if (!block) return false
      const logic = { ...block.logic }
      if (expr) logic[key] = expr
      else delete logic[key]
      block.logic = logic
      return true
    }, `${id}:logic:${key}`)
  }

  /** Binds one property of the selected block to an expression (or removes the binding). */
  setPropBinding(prop: string, expr: Expr | undefined): void {
    const id = this.selectedId()
    this.change((project) => {
      const block = findBlock(this.draftPage(project).blocks, id)
      if (!block) return false
      const props = { ...(block.logic.props ?? {}) }
      if (expr) props[prop] = expr
      else delete props[prop]
      block.logic = {
        ...block.logic,
        props: Object.keys(props).length ? props : undefined,
      }
      if (!block.logic.props) delete block.logic.props
      return true
    }, `${id}:bind:${prop}`)
  }

  addRule(): string {
    const rule = createRule(`Rule ${this.page().rules.length + 1}`)
    this.change((project) => {
      this.draftPage(project).rules.push(rule)
    })
    return rule.id
  }

  updateRule(
    ruleId: string,
    patch: Partial<Omit<PageRule, 'id' | 'effects' | 'otherwise'>>,
  ): void {
    this.change(
      (project) => {
        const rule = this.draftPage(project).rules.find(
          (item) => item.id === ruleId,
        )
        if (!rule) return false
        Object.assign(rule, patch)
        return true
      },
      `rule:${ruleId}:${Object.keys(patch).join()}`,
    )
  }

  removeRule(ruleId: string): void {
    this.change((project) => {
      const page = this.draftPage(project)
      page.rules = page.rules.filter((rule) => rule.id !== ruleId)
    })
  }

  moveRule(ruleId: string, delta: number): void {
    this.change((project) => {
      const rules = this.draftPage(project).rules
      const index = rules.findIndex((rule) => rule.id === ruleId)
      const target = index + delta
      if (index < 0 || target < 0 || target >= rules.length) return false
      ;[rules[index], rules[target]] = [rules[target], rules[index]]
      return true
    })
  }

  addEffect(
    ruleId: string,
    branch: 'effects' | 'otherwise',
    target = '',
  ): void {
    this.change((project) => {
      const rule = this.draftPage(project).rules.find(
        (item) => item.id === ruleId,
      )
      if (!rule) return false
      rule[branch].push({ id: newId(), target, kind: 'show' })
      return true
    })
  }

  updateEffect(
    ruleId: string,
    branch: 'effects' | 'otherwise',
    effectId: string,
    patch: Partial<RuleEffect>,
  ): void {
    this.change(
      (project) => {
        const effect = this.draftPage(project)
          .rules.find((item) => item.id === ruleId)
          ?.[branch].find((item) => item.id === effectId)
        if (!effect) return false
        Object.assign(effect, patch)
        if (patch.value === undefined && 'value' in patch) delete effect.value
        return true
      },
      `effect:${effectId}:${Object.keys(patch).join()}`,
    )
  }

  removeEffect(
    ruleId: string,
    branch: 'effects' | 'otherwise',
    effectId: string,
  ): void {
    this.change((project) => {
      const rule = this.draftPage(project).rules.find(
        (item) => item.id === ruleId,
      )
      if (!rule) return false
      rule[branch] = rule[branch].filter((item) => item.id !== effectId)
      return true
    })
  }

  addPageAction(type: Action['type']): void {
    this.change((project) => {
      const page = this.draftPage(project)
      if (page.actions.length >= LIMITS.actions) return false
      page.actions.push(createAction('load', type))
      return true
    })
  }

  delete(id = this.selectedId()): void {
    if (!id) return
    this.change((project) => !!removeBlock(this.draftPage(project).blocks, id))
    if (this.selectedId() === id) this.selectedId.set('')
  }

  duplicate(id = this.selectedId()): void {
    const source = findBlock(this.page().blocks, id)
    if (!source) return
    const copy = duplicateBlock(source)
    copy.name = `${source.name} copy`
    const ok = this.change((project) => {
      const page = this.draftPage(project)
      const parent = findParent(page.blocks, id)
      const siblings =
        parent && parent !== 'root' ? parent.children : page.blocks
      siblings.splice(
        siblings.findIndex((block) => block.id === id) + 1,
        0,
        copy,
      )
    })
    if (ok) this.selectedId.set(copy.id)
  }

  /** Moves the selection up or down among its siblings. */
  nudge(delta: number): void {
    const id = this.selectedId()
    this.change((project) => {
      const page = this.draftPage(project)
      const parent = findParent(page.blocks, id)
      const siblings =
        parent && parent !== 'root' ? parent.children : page.blocks
      const index = siblings.findIndex((block) => block.id === id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= siblings.length) return false
      ;[siblings[index], siblings[target]] = [siblings[target], siblings[index]]
      return true
    })
  }

  selectParent(): void {
    const parent = findParent(this.page().blocks, this.selectedId())
    this.selectedId.set(parent && parent !== 'root' ? parent.id : '')
  }

  /** Adds the child a structured container expects (tab, panel or step). */
  addStructuredChild(): void {
    const selected = this.selected()
    const childType = selected && definition(selected.type)?.accepts?.[0]
    if (!selected || !childType) return
    const label = `${definition(childType)!.label} ${selected.children.length + 1}`
    const key = childType === 'panel' ? 'title' : 'label'
    const child = createBlock(childType, { [key]: label })
    this.change((project) =>
      insertBlock(this.draftPage(project).blocks, child, selected.id),
    )
  }

  copy(): void {
    const selected = this.selected()
    if (selected) this.clipboard.set(structuredClone(selected))
  }

  paste(): void {
    const clip = this.clipboard()
    if (!clip) return
    const copy = duplicateBlock(clip)
    const selected = this.selected()
    const ok = this.change((project) => {
      const page = this.draftPage(project)
      if (selected && canContain(selected.type, copy.type))
        return insertBlock(page.blocks, copy, selected.id)
      if (selected) {
        const parent = findParent(page.blocks, selected.id)
        const siblings =
          parent && parent !== 'root' ? parent.children : page.blocks
        return insertBlock(
          page.blocks,
          copy,
          parent && parent !== 'root' ? parent.id : 'root',
          siblings.findIndex((block) => block.id === selected.id) + 1,
        )
      }
      return insertBlock(page.blocks, copy, 'root')
    })
    if (ok) this.selectedId.set(copy.id)
  }

  // -------------------------------------------------------------------------------------------
  // Pages
  // -------------------------------------------------------------------------------------------

  selectPage(id: string): void {
    this.pageId.set(id)
    this.selectedId.set('')
  }

  updatePage(
    patch: Partial<Pick<Page, 'name' | 'title' | 'icon' | 'inNav'>>,
  ): void {
    const id = this.pageId()
    this.change(
      (project) => {
        Object.assign(project.pages.find((page) => page.id === id)!, patch)
      },
      `page:${id}:${Object.keys(patch).join()}`,
    )
  }

  /** Returns an error message when the slug is unusable. */
  setSlug(value: string): string {
    const slug = slugify(value)
    if (
      this.project().pages.some(
        (page) => page.id !== this.pageId() && page.slug === slug,
      )
    )
      return 'Another page already uses this address.'
    this.change((project) => {
      project.pages.find((page) => page.id === this.pageId())!.slug = slug
    })
    return ''
  }

  duplicatePage(): void {
    const source = this.page()
    const id = newId()
    this.change((project) => {
      const copy: Page = {
        ...structuredClone(source),
        id,
        name: `${source.name} copy`,
        slug: uniqueSlug(project, `${source.slug}-copy`),
        blocks: source.blocks.map(duplicateBlock),
      }
      project.pages.splice(
        project.pages.findIndex((page) => page.id === source.id) + 1,
        0,
        copy,
      )
    })
    this.selectPage(id)
  }

  deletePage(): void {
    if (this.project().pages.length < 2) return
    const id = this.pageId()
    const index = this.project().pages.findIndex((page) => page.id === id)
    this.change((project) => {
      project.pages = project.pages.filter((page) => page.id !== id)
    })
    this.selectPage(this.project().pages[Math.max(0, index - 1)].id)
  }

  movePage(delta: number): void {
    const id = this.pageId()
    this.change((project) => {
      const index = project.pages.findIndex((page) => page.id === id)
      const target = index + delta
      if (target < 0 || target >= project.pages.length) return false
      ;[project.pages[index], project.pages[target]] = [
        project.pages[target],
        project.pages[index],
      ]
      return true
    })
  }

  // -------------------------------------------------------------------------------------------
  // App settings, variables and data
  // -------------------------------------------------------------------------------------------

  renameProject(name: string): void {
    this.change((project) => {
      project.name = name.slice(0, 200)
    }, 'project:name')
  }
  updateTheme(patch: Partial<ThemeSettings>): void {
    this.change((project) => {
      project.theme = { ...project.theme, ...patch }
    })
  }
  updateShell(patch: Partial<ShellSettings>): void {
    this.change(
      (project) => {
        project.shell = { ...project.shell, ...patch }
      },
      `shell:${Object.keys(patch).join()}`,
    )
  }

  addVariable(): void {
    this.change((project) => {
      if (project.variables.length >= LIMITS.variables) return false
      project.variables.push({
        id: newId(),
        name: uniqueVariableName(project, 'value'),
        initial: '',
        persist: false,
      })
      return true
    })
  }

  /** Returns an error message when the change is rejected. */
  updateVariable(id: string, patch: Partial<Variable>): string {
    if (patch.name !== undefined) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,40}$/.test(patch.name))
        return 'Use letters, digits and _ (not starting with a digit).'
      if (
        this.project().variables.some(
          (item) => item.id !== id && item.name === patch.name,
        )
      )
        return 'Another variable has this name.'
    }
    this.change(
      (project) => {
        Object.assign(project.variables.find((item) => item.id === id)!, patch)
      },
      `var:${id}:${Object.keys(patch).join()}`,
    )
    return ''
  }

  removeVariable(id: string): void {
    this.change((project) => {
      project.variables = project.variables.filter((item) => item.id !== id)
    })
  }

  addSource(kind: DataSource['kind']): void {
    this.change((project) => {
      if (project.dataSources.length >= LIMITS.sources) return false
      let name =
        kind === 'rest' ? 'api' : kind === 'collection' ? 'records' : 'items'
      for (
        let n = 2;
        project.dataSources.some((item) => item.name === name);
        n++
      )
        name = `${name.replace(/\d+$/, '')}${n}`
      project.dataSources.push(
        createSource(name, kind, {
          json:
            kind === 'static'
              ? JSON.stringify(
                  [
                    { id: 1, name: 'First item', description: 'Describe it' },
                    { id: 2, name: 'Second item', description: 'Describe it' },
                  ],
                  null,
                  2,
                )
              : '[]',
          url:
            kind === 'rest' ? 'https://jsonplaceholder.typicode.com/users' : '',
          mode: 'query',
        }),
      )
      return true
    })
  }

  updateSource(id: string, patch: Partial<DataSource>): string {
    if (patch.name !== undefined) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,40}$/.test(patch.name))
        return 'Use letters, digits and _ (not starting with a digit).'
      if (
        this.project().dataSources.some(
          (item) => item.id !== id && item.name === patch.name,
        )
      )
        return 'Another data source has this name.'
    }
    if (patch.json !== undefined) {
      if (patch.json.length > LIMITS.json)
        return 'Data is too large (200 KB maximum).'
      try {
        if (!Array.isArray(JSON.parse(patch.json || '[]')))
          return 'Enter a JSON array, e.g. [{"name":"Ada"}].'
      } catch {
        return 'This is not valid JSON yet.'
      }
    }
    this.change(
      (project) => {
        Object.assign(
          project.dataSources.find((item) => item.id === id)!,
          patch,
        )
      },
      `source:${id}:${Object.keys(patch).join()}`,
    )
    return ''
  }

  removeSource(id: string): void {
    this.change((project) => {
      project.dataSources = project.dataSources.filter((item) => item.id !== id)
    })
  }

  // -------------------------------------------------------------------------------------------
  // History & saving
  // -------------------------------------------------------------------------------------------

  undo(): void {
    const previous = this.history().at(-1)
    if (!previous) return
    this.future.update((future) => [...future, this.project()])
    this.history.update((history) => history.slice(0, -1))
    this.project.set(previous)
    this.lastCoalesce = { key: '', at: 0 }
    this.afterTimeTravel()
  }

  redo(): void {
    const next = this.future().at(-1)
    if (!next) return
    this.history.update((history) => [...history, this.project()])
    this.future.update((future) => future.slice(0, -1))
    this.project.set(next)
    this.lastCoalesce = { key: '', at: 0 }
    this.afterTimeTravel()
  }

  private afterTimeTravel(): void {
    if (!this.project().pages.some((page) => page.id === this.pageId()))
      this.pageId.set(this.project().pages[0].id)
    if (!findBlock(this.page().blocks, this.selectedId()))
      this.selectedId.set('')
    this.markDirty()
  }

  private markDirty(): void {
    this.saveState.set('dirty')
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.save(), 1500)
  }

  async save(): Promise<boolean> {
    clearTimeout(this.saveTimer)
    if (this.saveState() === 'saved') return true
    this.saveState.set('saving')
    const snapshot = this.project()
    try {
      const saved = await this.repository.save(snapshot)
      if (this.project() === snapshot)
        this.project.update((project) => ({
          ...project,
          updatedAt: saved.updatedAt,
        }))
      if (this.saveState() === 'saving') this.saveState.set('saved')
      this.saveError.set('')
      return true
    } catch (error) {
      this.saveState.set('error')
      this.saveError.set(
        error instanceof Error ? error.message : 'Could not save.',
      )
      return false
    }
  }

  async publish(): Promise<void> {
    await this.save()
    await this.repository.publish(this.project())
  }
}
