import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  HostListener,
  Injector,
  computed,
  effect,
  inject,
  input,
  signal,
  WritableSignal,
  viewChild,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { Router, RouterLink } from '@angular/router'
import { Title } from '@angular/platform-browser'
import { BreakpointObserver } from '@angular/cdk/layout'
import { map } from 'rxjs'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatMenuModule } from '@angular/material/menu'
import { MatSidenavModule } from '@angular/material/sidenav'
import { MatTabsModule } from '@angular/material/tabs'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatDialog } from '@angular/material/dialog'
import { Clipboard } from '@angular/cdk/clipboard'
import { MatDividerModule } from '@angular/material/divider'
import { Skeleton, ThemeSwitcher } from '@spsedu360/shared-ui'
import { SpecMode, TEMPLATES, exportPage, parseProject } from '../../core/model'
import { ProjectRepository } from '../../core/persistence/project-repository'
import {
  DragData,
  EDITOR_BRIDGE,
  EditorBridge,
} from '../../core/runtime/editor-bridge'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { SiteFrame } from '../renderer/site-frame'
import { BuilderStore } from './builder-store'
import { LibraryPanel } from './library-panel'
import { LayersPanel } from './layers-panel'
import { PagesPanel } from './pages-panel'
import { DataPanel } from './data-panel'
import { ThemePanel } from './theme-panel'
import { Inspector } from './inspector'
import { LogicPanel } from './logic/logic-panel'
import { ImportSpecDialog } from './import-spec-dialog'

/** Connects the renderer's drag-and-drop and selection to the studio store. */
class StudioBridge implements EditorBridge {
  private readonly lists = signal<Map<string, number>>(new Map())
  readonly connectedLists = computed(() =>
    [...this.lists().entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
  )
  readonly selectedId

  constructor(
    private readonly store: BuilderStore,
    private readonly onQuickAdd: (parentId: string) => void,
  ) {
    this.selectedId = store.selectedId.asReadonly()
  }

  select(id: string): void {
    this.store.selectedId.set(id)
  }

  registerList(id: string, depth: number): void {
    this.lists.update((lists) => new Map(lists).set(id, depth))
  }

  unregisterList(id: string): void {
    this.lists.update((lists) => {
      const next = new Map(lists)
      next.delete(id)
      return next
    })
  }

  canDrop(data: DragData, parentId: string): boolean {
    if (!data) return false
    if (data.kind === 'template') {
      const template = TEMPLATES.find((item) => item.id === data.templateId)
      return (
        !!template &&
        template.blocks.every((node) =>
          this.store.canPlace(node.type, parentId),
        )
      )
    }
    if (data.kind === 'move' && data.id === parentId) return false
    return this.store.canPlace(data.type, parentId)
  }

  drop(data: DragData, parentId: string, index: number): void {
    if (data.kind === 'new') this.store.add(data.type, parentId, index)
    else if (data.kind === 'move') this.store.move(data.id, parentId, index)
    else {
      const template = TEMPLATES.find((item) => item.id === data.templateId)
      if (template) this.store.insertTemplate(template, parentId, index)
    }
  }

  quickAdd(parentId: string): void {
    this.onQuickAdd(parentId)
  }
}

type LeftTab = 'add' | 'layers' | 'pages' | 'logic' | 'data' | 'theme'
const LEFT_TABS: LeftTab[] = [
  'add',
  'layers',
  'pages',
  'logic',
  'data',
  'theme',
]

@Component({
  selector: 'wb-studio',
  imports: [
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatSidenavModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatDividerModule,
    ThemeSwitcher,
    SiteFrame,
    LibraryPanel,
    LayersPanel,
    PagesPanel,
    DataPanel,
    LogicPanel,
    Skeleton,
    ThemePanel,
    Inspector,
  ],
  providers: [
    BuilderStore,
    SiteRuntime,
    {
      provide: EDITOR_BRIDGE,
      useFactory: (studio: Studio) => studio.bridge,
      deps: [Studio],
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './studio.html',
})
export class Studio {
  /** Route parameter. */
  readonly id = input.required<string>()
  /** `?import=ai` opens Import from AI once the project is loaded (used by “New app from AI”). */
  readonly import = input<string>()

  readonly store = inject(BuilderStore)
  readonly runtime = inject(SiteRuntime)
  private readonly repository = inject(ProjectRepository)
  private readonly snack = inject(MatSnackBar)
  private readonly dialog = inject(MatDialog)
  private readonly injector = inject(Injector)
  private readonly clipboard = inject(Clipboard)
  private readonly router = inject(Router)
  private readonly document = inject(DOCUMENT)
  private readonly title = inject(Title)
  private readonly library = viewChild(LibraryPanel)

  readonly bridge: StudioBridge = new StudioBridge(this.store, (parentId) => {
    if (parentId !== 'root') this.store.selectedId.set(parentId)
    this.leftOpen.set(true)
    this.leftTab.set('add')
    setTimeout(() => this.library()?.focusSearch())
  })

  readonly loading = signal(true)
  readonly notFound = signal(false)
  readonly leftTab = signal<LeftTab>('add')
  readonly leftTabIndex = computed(() => LEFT_TABS.indexOf(this.leftTab()))
  readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 1199.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  )
  readonly leftOpen = signal(true)
  readonly rightOpen = signal(true)

  /** Remembers panels the user opens or closes; closing for preview mode is not a user choice. */
  panelChanged(panel: WritableSignal<boolean>, opened: boolean): void {
    if (!this.store.preview()) panel.set(opened)
  }
  readonly saveLabel = computed(
    () =>
      ({
        saved: 'All changes saved',
        dirty: 'Unsaved changes',
        saving: 'Saving…',
        error: 'Save failed',
      })[this.store.saveState()],
  )
  readonly where =
    this.repository.location === 'server' ? 'on the server' : 'in this browser'

  constructor() {
    // Feed the renderer.
    effect(() => this.runtime.project.set(this.store.project()))
    effect(() => this.runtime.pageId.set(this.store.page().id))
    effect(() =>
      this.runtime.mode.set(this.store.preview() ? 'preview' : 'edit'),
    )
    this.runtime.onNavigate((pageId) => this.store.selectPage(pageId))

    // Panels collapse into overlays on smaller screens.
    effect(() => {
      const compact = this.compact()
      this.leftOpen.set(!compact)
      this.rightOpen.set(!compact)
    })
    effect(() => {
      if (this.compact() && this.store.selectedId()) this.rightOpen.set(true)
    })

    effect(() => this.title.setTitle(`${this.store.project().name} · Studio`))

    effect(() => {
      void this.open(this.id())
    })

    const unload = (event: BeforeUnloadEvent) => {
      if (this.store.saveState() !== 'saved') {
        void this.store.save()
        event.preventDefault()
      }
    }
    this.document.defaultView?.addEventListener('beforeunload', unload)
    inject(DestroyRef).onDestroy(() => {
      this.document.defaultView?.removeEventListener('beforeunload', unload)
      void this.store.save()
    })
  }

  private async open(id: string): Promise<void> {
    this.loading.set(true)
    try {
      const project = await this.repository.get(id)
      if (project) {
        this.store.load(project)
        if (this.import() === 'ai')
          setTimeout(() => this.openImport('', 'replace'))
      } else this.notFound.set(true)
    } catch (error) {
      this.notFound.set(true)
      this.snack.open(
        error instanceof Error ? error.message : 'Could not open the project.',
        'Close',
      )
    } finally {
      this.loading.set(false)
    }
  }

  selectTab(index: number): void {
    this.leftTab.set(LEFT_TABS[index] ?? 'add')
  }

  togglePreview(): void {
    this.store.preview.update((value) => !value)
    if (this.store.preview()) this.store.selectedId.set('')
  }

  async save(): Promise<void> {
    const ok = await this.store.save()
    this.snack.open(
      ok ? `Saved ${this.where}.` : this.store.saveError(),
      'Close',
      { duration: 3000 },
    )
  }

  async publish(): Promise<void> {
    try {
      await this.store.publish()
      const ref = this.snack.open('Published. Your app is live.', 'Open', {
        duration: 6000,
      })
      ref.onAction().subscribe(() => this.openPublished())
    } catch (error) {
      this.snack.open(
        error instanceof Error ? error.message : 'Could not publish.',
        'Close',
      )
    }
  }

  openPublished(): void {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([
        '/app',
        this.store.project().id,
        this.store.page().slug,
      ]),
    )
    this.document.defaultView?.open(url, '_blank', 'noopener')
  }

  private download(name: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = this.document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  openImport(text = '', mode: SpecMode = 'new'): void {
    this.dialog
      .open(ImportSpecDialog, {
        data: { text, mode },
        autoFocus: false,
        maxWidth: '96vw',
        injector: this.injector,
      })
      .afterClosed()
      .subscribe((name?: string) => {
        if (name)
          this.snack.open(
            `Imported into “${name}”. Undo (Ctrl+Z) restores the previous version.`,
            'Close',
            { duration: 5000 },
          )
      })
  }

  copyPageSpec(): void {
    this.clipboard.copy(JSON.stringify(this.store.pageSpec(), null, 2))
    this.snack.open(
      'Page JSON copied. Paste it into your AI assistant with the change you want.',
      'Close',
      { duration: 4000 },
    )
  }

  downloadPageSpec(): void {
    const spec = this.store.pageSpec()
    this.download(
      `${(spec.path || 'page').replace(/[^\w-]+/g, '-')}.page.json`,
      JSON.stringify(spec, null, 2),
      'application/json',
    )
  }

  exportJson(): void {
    const project = this.store.project()
    this.download(
      `${project.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'project'}.builder.json`,
      JSON.stringify(project, null, 2),
      'application/json',
    )
  }

  exportHtml(): void {
    let css = ''
    for (const sheet of Array.from(this.document.styleSheets)) {
      if (
        (sheet.ownerNode as HTMLElement | null)?.id?.startsWith('wb-overrides-')
      )
        continue
      try {
        css += Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n')
      } catch {
        /* cross-origin sheet */
      }
    }
    const page = this.store.page()
    this.download(
      `${page.slug}.html`,
      exportPage(
        this.store.project(),
        page,
        Object.fromEntries(
          this.store
            .project()
            .dataSources.map((source) => [
              source.id,
              this.runtime.rowsFor(source.id),
            ]),
        ),
        css,
      ),
      'text/html',
    )
    this.snack.open(
      'Static HTML exported. Actions and live data need the published app.',
      'Close',
      { duration: 5000 },
    )
  }

  async importJson(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      if (file.size > 4_000_000)
        throw new Error('The file is larger than 4 MB.')
      const imported = parseProject(await file.text())
      const current = this.store.project()
      // Keep this project's identity so the import replaces its content (undo restores the previous version).
      this.store.change((project) => {
        Object.assign(project, { ...imported, id: current.id })
      })
      this.store.selectPage(this.store.project().pages[0].id)
      this.snack.open(
        'Project imported. Undo restores the previous version.',
        'Close',
        { duration: 4000 },
      )
    } catch (error) {
      this.snack.open(
        error instanceof Error ? error.message : 'Unable to import this file.',
        'Close',
      )
    }
  }

  @HostListener('document:keydown', ['$event'])
  shortcuts(event: KeyboardEvent): void {
    const target = event.target as HTMLElement
    const typing = !!target.closest(
      'input, textarea, select, [contenteditable], .mat-mdc-select, .cdk-overlay-container',
    )
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && key === 's') {
      event.preventDefault()
      void this.save()
      return
    }
    if (typing) return
    if (mod && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) this.store.redo()
      else this.store.undo()
      return
    }
    if (mod && key === 'y') {
      event.preventDefault()
      this.store.redo()
      return
    }
    if (this.store.preview()) {
      if (key === 'escape') this.togglePreview()
      return
    }
    if (mod && key === 'd') {
      event.preventDefault()
      this.store.duplicate()
      return
    }
    if (mod && key === 'c') {
      this.store.copy()
      return
    }
    if (mod && key === 'v') {
      event.preventDefault()
      this.store.paste()
      return
    }
    if ((key === 'delete' || key === 'backspace') && this.store.selectedId()) {
      event.preventDefault()
      this.store.delete()
      return
    }
    if (key === 'escape') {
      this.store.selectParent()
      return
    }
    if (event.altKey && key === 'arrowup') {
      event.preventDefault()
      this.store.nudge(-1)
      return
    }
    if (event.altKey && key === 'arrowdown') {
      event.preventDefault()
      this.store.nudge(1)
    }
  }
}
