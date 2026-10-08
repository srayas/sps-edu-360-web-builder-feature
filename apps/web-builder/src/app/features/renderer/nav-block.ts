import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatListModule } from '@angular/material/list'
import { MatMenuModule } from '@angular/material/menu'
import { MatTabsModule } from '@angular/material/tabs'
import {
  Block,
  Scope,
  blockClasses,
  interpolate,
  lines,
  safeUrl,
} from '../../core/model'
import { SiteRuntime } from '../../core/runtime/site-runtime'

interface NavLink {
  label: string
  href: string
  icon: string
  pageId: string
  active: boolean
}

@Component({
  selector: 'wb-nav-block',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatTabsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  template: `
    @let b = block();
    @switch (b.type) {
      @case ('nav') {
        @if (b.props['variant'] === 'tabs') {
          <nav
            mat-tab-nav-bar
            [tabPanel]="panel"
            [class]="classes()"
            [attr.aria-label]="b.name"
          >
            @for (link of links(); track $index) {
              <a
                mat-tab-link
                [href]="link.href"
                [active]="link.active"
                (click)="go($event, link)"
                >{{ link.label }}</a
              >
            }
          </nav>
          <mat-tab-nav-panel #panel />
        } @else {
          <nav
            [class]="
              classes() +
              ' ui-row ui-wrap ui-align-center ui-gap-1 ui-justify-' +
              b.props['justify']
            "
            [attr.aria-label]="b.name"
          >
            @for (link of links(); track $index) {
              <a
                [matButton]="
                  link.active || b.props['variant'] === 'tonal'
                    ? 'tonal'
                    : 'text'
                "
                [href]="link.href"
                [attr.aria-current]="link.active ? 'page' : null"
                (click)="go($event, link)"
                >{{ link.label }}</a
              >
            }
          </nav>
        }
      }
      @case ('nav-list') {
        <mat-nav-list [class]="classes()" [attr.aria-label]="b.name">
          @for (link of links(); track $index) {
            <a
              mat-list-item
              [href]="link.href"
              [activated]="link.active"
              (click)="go($event, link)"
            >
              @if (link.icon) {
                <mat-icon matListItemIcon>{{ link.icon }}</mat-icon>
              }
              <span matListItemTitle>{{ link.label }}</span>
            </a>
          }
        </mat-nav-list>
      }
      @case ('menu') {
        <div [class]="classes()">
          <button matButton="outlined" type="button" [matMenuTriggerFor]="menu">
            @if (b.props['icon']) {
              <mat-icon>{{ b.props['icon'] }}</mat-icon>
            }
            {{ t('text') }}
          </button>
          <mat-menu #menu="matMenu" [class]="runtime.themeClasses()">
            @for (link of links(); track $index) {
              <a mat-menu-item [href]="link.href" (click)="go($event, link)">
                @if (link.icon) {
                  <mat-icon>{{ link.icon }}</mat-icon>
                }
                <span>{{ link.label }}</span>
              </a>
            }
          </mat-menu>
        </div>
      }
      @case ('breadcrumbs') {
        <nav [class]="classes()" aria-label="Breadcrumb">
          <ol
            class="wb-breadcrumbs ui-row ui-wrap ui-align-center ui-gap-1 ui-m-0 mat-font-body-md"
          >
            @for (link of links(); track $index; let last = $last) {
              <li class="ui-inline ui-gap-1">
                @if (last) {
                  <span aria-current="page">{{ link.label }}</span>
                } @else {
                  <a [href]="link.href" (click)="go($event, link)">{{
                    link.label
                  }}</a>
                  <mat-icon
                    class="ui-icon-sm mat-text-on-surface-variant"
                    aria-hidden="true"
                    >chevron_right</mat-icon
                  >
                }
              </li>
            }
          </ol>
        </nav>
      }
    }
  `,
})
export class NavBlock {
  readonly block = input.required<Block>()
  readonly scope = input.required<Scope>()
  readonly runtime = inject(SiteRuntime)
  readonly classes = computed(() => blockClasses(this.block()))

  readonly links = computed<NavLink[]>(() => {
    const block = this.block()
    const project = this.runtime.project()
    const current = this.runtime.page().id
    if (block.props['usePages']) {
      return project.pages
        .filter((page) => page.inNav)
        .map((page) => ({
          label: page.name,
          href: `#${page.slug}`,
          icon: page.icon,
          pageId: page.id,
          active: page.id === current,
        }))
    }
    return lines(interpolate(block.props['items'], this.scope())).map(
      ([label, href = '', icon = '']) => {
        const target = project.pages.find(
          (page) => href === `#${page.slug}` || href === `/${page.slug}`,
        )
        return {
          label,
          href: safeUrl(href) || '#',
          icon,
          pageId: target?.id ?? '',
          active: target?.id === current,
        }
      },
    )
  })

  t(key: string): string {
    return interpolate(this.block().props[key], this.scope())
  }

  go(event: Event, link: NavLink): void {
    if (this.runtime.mode() === 'edit') {
      event.preventDefault()
      return
    }
    if (link.pageId) {
      event.preventDefault()
      void this.runtime.run(
        [
          {
            id: 'nav',
            trigger: 'click',
            type: 'navigate',
            target: link.pageId,
            value: '',
          },
        ],
        'click',
        { scope: this.scope() },
      )
    } else if (link.href.startsWith('#')) {
      event.preventDefault()
      void this.runtime.run(
        [
          {
            id: 'anchor',
            trigger: 'click',
            type: 'openUrl',
            target: link.href,
            value: '',
          },
        ],
        'click',
        { scope: this.scope() },
      )
    }
  }
}
