import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { BreakpointObserver } from '@angular/cdk/layout'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { map } from 'rxjs'
import { MatSidenavModule } from '@angular/material/sidenav'
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { MatDividerModule } from '@angular/material/divider'
import { NavBar } from './nav-bar'
import { TeamSwitcher } from './team-switcher'
import { ShellService, Team } from './shell.service'

/**
 * Application frame: Material side navigation, top bar and a scrolling content area.
 * Routed pages configure it through {@link ShellService}; content is projected.
 */
@Component({
  selector: 'ui-app-shell',
  imports: [
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    RouterLink,
    RouterLinkActive,
    NavBar,
    TeamSwitcher,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="ui-shell">
      @if (shell.showNavigation()) {
        <mat-sidenav
          class="ui-shell-nav"
          [mode]="handset() ? 'over' : 'side'"
          [opened]="opened()"
          (openedChange)="userOpened.set($event)"
        >
          <div class="ui-column ui-full-height">
            <a
              routerLink="/"
              class="ui-row ui-align-center ui-gap-3 ui-px-4 ui-shell-brand mat-text-on-surface"
              aria-label="Home"
            >
              <mat-icon class="mat-text-primary">{{ brandIcon() }}</mat-icon>
              <span class="mat-font-title-lg">{{ shell.title() }}</span>
            </a>
            <mat-nav-list
              class="ui-grow ui-scroll"
              aria-label="Main navigation"
            >
              @for (item of shell.menu(); track item.label) {
                @if (item.children?.length) {
                  <div mat-subheader>{{ item.label }}</div>
                  @for (child of item.children; track child.label) {
                    <a
                      mat-list-item
                      class="ui-nav-child"
                      [routerLink]="child.route"
                      routerLinkActive="ui-active-link"
                      [routerLinkActiveOptions]="{ exact: !!child.exact }"
                      (click)="closeOnHandset()"
                    >
                      @if (child.icon) {
                        <mat-icon matListItemIcon>{{ child.icon }}</mat-icon>
                      }
                      <span matListItemTitle>{{ child.label }}</span>
                    </a>
                  }
                } @else {
                  <a
                    mat-list-item
                    [routerLink]="item.route"
                    routerLinkActive="ui-active-link"
                    [routerLinkActiveOptions]="{ exact: !!item.exact }"
                    (click)="closeOnHandset()"
                  >
                    @if (item.icon) {
                      <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                    }
                    <span matListItemTitle>{{ item.label }}</span>
                  </a>
                }
              }
            </mat-nav-list>
            @if (teams().length) {
              <mat-divider />
              <ui-team-switcher class="ui-p-2" [teams]="teams()" />
            }
          </div>
        </mat-sidenav>
      }
      <mat-sidenav-content>
        <ui-nav-bar
          [showMenuToggle]="shell.showNavigation()"
          (menuToggle)="userOpened.set(!opened())"
        >
          <ng-content select="[uiNavActions]" />
        </ui-nav-bar>
        <main class="ui-shell-main">
          <ng-content />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class AppShell {
  readonly shell = inject(ShellService)
  readonly brandIcon = input('school')
  readonly teams = input<Team[]>([])

  readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  )
  readonly userOpened = signal<boolean | null>(null)
  readonly opened = computed(() => this.userOpened() ?? !this.handset())

  closeOnHandset(): void {
    if (this.handset()) this.userOpened.set(false)
  }
}
