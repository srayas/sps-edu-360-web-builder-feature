import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  signal,
} from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { DatePipe } from '@angular/common'
import { MatButtonModule } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatChipsModule } from '@angular/material/chips'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatDividerModule } from '@angular/material/divider'
import {
  ConfirmService,
  EmptyState,
  PageHeader,
  ShellService,
  Skeleton,
} from '@spsedu360/shared-ui'
import {
  ProjectSummary,
  TEMPLATES,
  Template,
  createProject,
  instantiate,
  mergeTemplateData,
  newId,
  parseProject,
} from '../../core/model'
import { ProjectRepository } from '../../core/persistence/project-repository'

@Component({
  selector: 'wb-projects',
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    PageHeader,
    EmptyState,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column ui-p-5 ui-max-xl ui-mx-auto">
      <ui-page-header
        heading="Projects"
        [description]="'Apps you are building. Stored ' + where + '.'"
      >
        <button matButton="outlined" type="button" (click)="fileInput.click()">
          <mat-icon>upload_file</mat-icon>Import
        </button>
        <button matButton="filled" type="button" [matMenuTriggerFor]="create">
          <mat-icon>add</mat-icon>New app
        </button>
        <mat-menu #create="matMenu">
          <button mat-menu-item (click)="createApp()">
            <mat-icon>note_add</mat-icon><span>Blank app</span>
          </button>
          <mat-divider />
          @for (template of templates; track template.id) {
            <button mat-menu-item (click)="createApp(template)">
              <mat-icon>{{ template.icon }}</mat-icon
              ><span>{{ template.name }}</span>
            </button>
          }
        </mat-menu>
      </ui-page-header>
      <input
        #fileInput
        type="file"
        accept="application/json,.json"
        class="ui-visually-hidden"
        tabindex="-1"
        aria-hidden="true"
        (change)="importFile($event)"
      />

      @if (loading()) {
        <div
          class="ui-grid ui-cols-auto ui-gap-4"
          aria-busy="true"
          aria-label="Loading projects"
        >
          @for (n of [1, 2, 3, 4, 5, 6]; track n) {
            <ui-skeleton shape="card" />
          }
        </div>
      } @else if (filtered().length) {
        <div class="ui-grid ui-cols-auto ui-gap-4">
          @for (project of filtered(); track project.id) {
            <mat-card appearance="outlined" class="wb-project-card ui-enter">
              <a
                [routerLink]="['/builder', project.id]"
                class="wb-project-thumb ui-row ui-align-center ui-justify-center"
                [attr.aria-label]="'Open ' + project.name"
              >
                <span class="wb-project-initials">{{
                  initials(project.name)
                }}</span>
              </a>
              <mat-card-header>
                <mat-card-title class="ui-truncate">{{
                  project.name
                }}</mat-card-title>
                <mat-card-subtitle
                  >{{ project.pages }}
                  {{ project.pages === 1 ? 'page' : 'pages' }} · Edited
                  {{
                    project.updatedAt | date: 'MMM d, h:mm a'
                  }}</mat-card-subtitle
                >
              </mat-card-header>
              <mat-card-actions class="ui-row ui-align-center ui-gap-2">
                <a matButton="tonal" [routerLink]="['/builder', project.id]"
                  ><mat-icon>edit</mat-icon>Edit</a
                >
                @if (project.published) {
                  <a
                    matButton
                    [routerLink]="['/app', project.id]"
                    target="_blank"
                    ><mat-icon>open_in_new</mat-icon>View</a
                  >
                }
                <span class="ui-spacer"></span>
                <button
                  matIconButton
                  type="button"
                  [matMenuTriggerFor]="menu"
                  [attr.aria-label]="'More actions for ' + project.name"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="duplicate(project)">
                    <mat-icon>content_copy</mat-icon><span>Duplicate</span>
                  </button>
                  <button mat-menu-item (click)="download(project)">
                    <mat-icon>download</mat-icon><span>Export JSON</span>
                  </button>
                  <button mat-menu-item (click)="remove(project)">
                    <mat-icon>delete_outline</mat-icon><span>Delete</span>
                  </button>
                </mat-menu>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      } @else if (projects().length) {
        <ui-empty-state
          icon="search_off"
          heading="No matches"
          [message]="'No project names contain “' + shell.search() + '”.'"
        />
      } @else {
        <ui-empty-state
          icon="dashboard_customize"
          heading="Build your first app"
          message="Start blank or from a template. Everything is themed with Angular Material."
        >
          <button matButton="filled" type="button" (click)="createApp(landing)">
            <mat-icon>rocket_launch</mat-icon>Start from a landing page
          </button>
          <button matButton="outlined" type="button" (click)="createApp()">
            Blank app
          </button>
        </ui-empty-state>
      }
    </div>
  `,
})
export class Projects {
  private readonly repository = inject(ProjectRepository)
  private readonly router = inject(Router)
  private readonly snack = inject(MatSnackBar)
  private readonly confirm = inject(ConfirmService)
  private readonly document = inject(DOCUMENT)
  readonly shell = inject(ShellService)

  readonly where =
    this.repository.location === 'server' ? 'on the server' : 'in this browser'
  readonly templates = TEMPLATES.filter((template) => template.kind === 'page')
  readonly landing = TEMPLATES.find(
    (template) => template.id === 'page-landing',
  )
  readonly loading = signal(true)

  initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    return (
      (
        (words[0]?.[0] ?? '') + (words[1]?.[0] ?? words[0]?.[1] ?? '')
      ).toUpperCase() || 'A'
    )
  }
  readonly projects = signal<ProjectSummary[]>([])
  readonly filtered = computed(() => {
    const term = this.shell.search().trim().toLowerCase()
    return this.projects().filter((project) =>
      project.name.toLowerCase().includes(term),
    )
  })

  constructor() {
    this.shell.breadcrumbs.set([
      { label: 'Home', route: '/' },
      { label: 'Projects' },
    ])
    void this.refresh()
  }

  async refresh(): Promise<void> {
    this.loading.set(true)
    try {
      this.projects.set(await this.repository.list())
    } catch (error) {
      this.snack.open(
        error instanceof Error ? error.message : 'Could not load projects.',
        'Close',
      )
    } finally {
      this.loading.set(false)
    }
  }

  async createApp(template?: Template): Promise<void> {
    const project = createProject(
      template ? template.name.replace(/ page$/i, '') : 'Untitled app',
    )
    if (template) {
      project.pages[0].blocks = instantiate(
        template.blocks,
        mergeTemplateData(project, template),
      )
      project.shell.enabled = !template.blocks.some(
        (node) => node.type === 'toolbar',
      )
    }
    await this.persist(project)
  }

  async duplicate(summary: ProjectSummary): Promise<void> {
    const project = await this.repository.get(summary.id)
    if (!project) return
    // Ids only need to be unique within a project, so page links and actions keep working in the copy.
    await this.persist({
      ...project,
      id: newId(),
      name: `${project.name} copy`,
    })
  }

  async download(summary: ProjectSummary): Promise<void> {
    const project = await this.repository.get(summary.id)
    if (!project) return
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(project, null, 2)], {
        type: 'application/json',
      }),
    )
    const link = this.document.createElement('a')
    link.href = url
    link.download = `${project.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'project'}.builder.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async remove(summary: ProjectSummary): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Delete “${summary.name}”?`,
      message: 'The project and its published app will be removed permanently.',
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return
    await this.repository.remove(summary.id)
    await this.refresh()
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      if (file.size > 4_000_000)
        throw new Error('The file is larger than 4 MB.')
      const project = parseProject(await file.text())
      await this.persist({ ...project, id: newId() })
    } catch (error) {
      this.snack.open(
        error instanceof Error ? error.message : 'Unable to import this file.',
        'Close',
      )
    }
  }

  private async persist(
    project: Parameters<ProjectRepository['save']>[0],
  ): Promise<void> {
    try {
      const saved = await this.repository.save(project)
      await this.router.navigate(['/builder', saved.id])
    } catch (error) {
      this.snack.open(
        error instanceof Error
          ? error.message
          : 'Could not create the project.',
        'Close',
      )
    }
  }
}
