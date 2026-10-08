import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { Title } from '@angular/platform-browser'
import { MatButtonModule } from '@angular/material/button'
import { EmptyState, Skeleton } from '@spsedu360/shared-ui'
import { ProjectRepository } from '../../core/persistence/project-repository'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { SiteFrame } from '../renderer/site-frame'

/** The published application: renders the published snapshot with live actions and data. */
@Component({
  selector: 'wb-viewer',
  imports: [RouterLink, MatButtonModule, Skeleton, EmptyState, SiteFrame],
  providers: [SiteRuntime],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state() === 'loading') {
      <div
        class="ui-p-5 ui-max-lg ui-mx-auto"
        aria-busy="true"
        aria-label="Loading the app"
      >
        <ui-skeleton shape="page" />
      </div>
    } @else if (state() === 'missing') {
      <ui-empty-state
        icon="cloud_off"
        heading="This app is not published"
        message="Open it in the studio and choose Publish."
      >
        <a matButton="filled" routerLink="/projects">Go to projects</a>
      </ui-empty-state>
    } @else {
      <wb-site-frame frameClass="wb-published" />
    }
  `,
})
export class Viewer {
  readonly id = input.required<string>()
  readonly slug = input<string>()

  private readonly runtime = inject(SiteRuntime)
  private readonly repository = inject(ProjectRepository)
  private readonly router = inject(Router)
  private readonly title = inject(Title)
  private readonly document = inject(DOCUMENT)
  readonly state = signal<'loading' | 'ready' | 'missing'>('loading')
  private readonly loadedId = signal('')

  private readonly pageFromSlug = computed(() => {
    const pages = this.runtime.project().pages
    return pages.find((page) => page.slug === this.slug()) ?? pages[0]
  })

  constructor() {
    this.runtime.mode.set('live')
    this.runtime.onNavigate((pageId) => {
      const page = this.runtime
        .project()
        .pages.find((item) => item.id === pageId)
      if (page) void this.router.navigate(['/app', this.id(), page.slug])
    })

    effect(() => {
      const id = this.id()
      if (id !== this.loadedId()) void this.load(id)
    })
    effect(() => {
      if (this.state() !== 'ready') return
      const page = this.pageFromSlug()
      this.runtime.pageId.set(page.id)
      this.title.setTitle(
        `${page.title || page.name} · ${this.runtime.project().name}`,
      )
      this.document.defaultView?.scrollTo({ top: 0 })
    })
  }

  private async load(id: string): Promise<void> {
    this.loadedId.set(id)
    this.state.set('loading')
    try {
      const project = await this.repository.published(id)
      if (!project) {
        this.state.set('missing')
        return
      }
      this.runtime.project.set(project)
      this.state.set('ready')
    } catch {
      this.state.set('missing')
    }
  }
}
