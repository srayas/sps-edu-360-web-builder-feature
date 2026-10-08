import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatListModule } from '@angular/material/list'
import { MatMenuModule } from '@angular/material/menu'
import { blockCss, interpolate, siteThemeClasses } from '../../core/model'
import { DIALOG_HOST, SiteRuntime } from '../../core/runtime/site-runtime'
import { BlockList } from './block-list'
import { SiteDialog } from './site-dialog'

DIALOG_HOST.component = SiteDialog

let frameCount = 0

/**
 * Root of a rendered site page: applies the project theme, wraps the page in the optional
 * Material app shell, maintains the generated override stylesheet and runs page-load actions.
 */
@Component({
  selector: 'wb-site-frame',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    BlockList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  template: `
    @let project = runtime.project();
    @let page = runtime.page();
    <div [class]="rootClasses()">
      @if (project.shell.enabled) {
        <div [class]="'wb-shell wb-shell-' + project.shell.layout">
          <header
            class="wb-shell-header mat-bg-surface-container-low mat-text-on-surface"
          >
            <a
              class="wb-shell-brand ui-row ui-align-center ui-gap-2 mat-text-on-surface"
              [href]="'#' + (navPages()[0]?.slug ?? '')"
              (click)="go($event, navPages()[0]?.id)"
            >
              <mat-icon class="mat-text-primary">{{
                project.shell.icon
              }}</mat-icon>
              <span class="mat-font-title-lg ui-truncate">{{
                project.shell.title || project.name
              }}</span>
            </a>
            @if (project.shell.layout === 'top') {
              <nav
                class="wb-shell-links ui-row ui-align-center ui-gap-1"
                aria-label="Pages"
              >
                @for (item of navPages(); track item.id) {
                  <a
                    [matButton]="item.id === page.id ? 'tonal' : 'text'"
                    [href]="'#' + item.slug"
                    [attr.aria-current]="item.id === page.id ? 'page' : null"
                    (click)="go($event, item.id)"
                    >{{ item.name }}</a
                  >
                }
              </nav>
              <button
                matIconButton
                class="wb-shell-menu"
                [matMenuTriggerFor]="pagesMenu"
                aria-label="Open navigation"
              >
                <mat-icon>menu</mat-icon>
              </button>
              <mat-menu #pagesMenu="matMenu" [class]="runtime.themeClasses()">
                @for (item of navPages(); track item.id) {
                  <a
                    mat-menu-item
                    [href]="'#' + item.slug"
                    (click)="go($event, item.id)"
                    ><mat-icon>{{ item.icon }}</mat-icon
                    ><span>{{ item.name }}</span></a
                  >
                }
              </mat-menu>
            } @else {
              <mat-nav-list class="wb-shell-nav" aria-label="Pages">
                @for (item of navPages(); track item.id) {
                  <a
                    mat-list-item
                    [href]="'#' + item.slug"
                    [activated]="item.id === page.id"
                    (click)="go($event, item.id)"
                  >
                    <mat-icon matListItemIcon>{{ item.icon }}</mat-icon
                    ><span matListItemTitle>{{ item.name }}</span>
                  </a>
                }
              </mat-nav-list>
            }
          </header>
          <div class="wb-shell-body ui-column ui-min-0">
            <main class="wb-page" [attr.aria-label]="page.title || page.name">
              <wb-block-list
                [blocks]="page.blocks"
                parentId="root"
                parentType="root"
                layoutClass="ui-column wb-page-root"
                [scope]="runtime.scope()"
              />
            </main>
            @if (project.shell.footer) {
              <footer
                class="wb-shell-footer mat-font-body-sm mat-text-on-surface-variant ui-divider-top"
              >
                {{ footer() }}
              </footer>
            }
          </div>
        </div>
      } @else {
        <main class="wb-page" [attr.aria-label]="page.title || page.name">
          <wb-block-list
            [blocks]="page.blocks"
            parentId="root"
            parentType="root"
            layoutClass="ui-column wb-page-root"
            [scope]="runtime.scope()"
          />
        </main>
      }
    </div>
  `,
})
export class SiteFrame {
  readonly runtime = inject(SiteRuntime)
  /** Extra classes for the root, e.g. the studio viewport width. */
  readonly frameClass = input('')

  readonly rootClasses = computed(
    () =>
      `${siteThemeClasses(this.runtime.project().theme)} wb-mode-${this.runtime.mode()} ${this.frameClass()}`,
  )
  readonly navPages = computed(() =>
    this.runtime.project().pages.filter((page) => page.inNav),
  )
  readonly footer = computed(() =>
    interpolate(this.runtime.project().shell.footer, this.runtime.scope()),
  )

  constructor() {
    const document = inject(DOCUMENT)
    const style = document.createElement('style')
    style.id = `wb-overrides-${++frameCount}`
    document.head.appendChild(style)
    inject(DestroyRef).onDestroy(() => style.remove())

    // User overrides for every block of the current page, compiled into one stylesheet.
    effect(() => {
      style.textContent = this.runtime.page().blocks.map(blockCss).join('\n')
    })

    // Page-load actions, once per page visit.
    const visit = computed(
      () => `${this.runtime.mode()}:${this.runtime.page().id}`,
    )
    effect(() => {
      if (visit().startsWith('edit:')) return
      untracked(
        () =>
          void this.runtime.run(this.runtime.page().actions, 'load', {
            scope: this.runtime.scope(),
          }),
      )
    })
  }

  go(event: Event, pageId: string | undefined): void {
    event.preventDefault()
    if (!pageId || this.runtime.mode() === 'edit') return
    void this.runtime.run(
      [
        {
          id: 'nav',
          trigger: 'click',
          type: 'navigate',
          target: pageId,
          value: '',
        },
      ],
      'click',
      { scope: this.runtime.scope() },
    )
  }
}
