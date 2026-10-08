import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MatIconModule } from '@angular/material/icon'
import { Breadcrumb } from './shell.service'

@Component({
  selector: 'ui-breadcrumbs',
  imports: [RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      aria-label="Breadcrumb"
      class="ui-row ui-align-center ui-gap-1 mat-font-body-md ui-min-0"
    >
      @for (crumb of items(); track $index; let last = $last) {
        @if (crumb.route && !last) {
          <a
            [routerLink]="crumb.route"
            class="mat-text-on-surface-variant ui-truncate"
            >{{ crumb.label }}</a
          >
          <mat-icon
            class="ui-icon-sm mat-text-on-surface-variant"
            aria-hidden="true"
            >chevron_right</mat-icon
          >
        } @else {
          <span
            class="ui-truncate"
            [attr.aria-current]="last ? 'page' : null"
            >{{ crumb.label }}</span
          >
        }
      }
    </nav>
  `,
})
export class Breadcrumbs {
  readonly items = input<Breadcrumb[]>([])
}
