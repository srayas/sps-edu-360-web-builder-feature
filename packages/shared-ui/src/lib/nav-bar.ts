import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatDividerModule } from '@angular/material/divider'
import { Breadcrumbs } from './breadcrumbs'
import { SearchBar } from './search-bar'
import { ThemeSwitcher } from './theme-switcher'
import { ShellService } from './shell.service'

@Component({
  selector: 'ui-nav-bar',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    Breadcrumbs,
    SearchBar,
    ThemeSwitcher,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="ui-nav-bar ui-divider-bottom ui-gap-2">
      @if (showMenuToggle()) {
        <button
          mat-icon-button
          aria-label="Toggle navigation"
          (click)="menuToggle.emit()"
        >
          <mat-icon>menu</mat-icon>
        </button>
      }
      <ui-breadcrumbs class="ui-grow ui-min-0" [items]="shell.breadcrumbs()" />
      @if (showSearch()) {
        <ui-search-bar
          class="ui-nav-search ui-hide-mobile"
          placeholder="Search"
          [(value)]="shell.search"
        />
      }
      <ng-content />
      <ui-theme-switcher />
    </mat-toolbar>
  `,
})
export class NavBar {
  readonly shell = inject(ShellService)
  readonly showMenuToggle = input(true)
  readonly showSearch = input(true)
  readonly menuToggle = output<void>()
}
