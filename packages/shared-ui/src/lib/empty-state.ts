import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MatIconModule } from '@angular/material/icon'

@Component({
  selector: 'ui-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="ui-column ui-align-center ui-text-center ui-gap-3 ui-p-7"
      role="status"
    >
      <mat-icon
        class="ui-icon-xl mat-text-on-surface-variant"
        aria-hidden="true"
        >{{ icon() }}</mat-icon
      >
      <h2 class="mat-font-title-lg ui-m-0">{{ heading() }}</h2>
      @if (message()) {
        <p class="mat-font-body-md mat-text-on-surface-variant ui-m-0">
          {{ message() }}
        </p>
      }
      <div class="ui-row ui-wrap ui-justify-center ui-gap-2">
        <ng-content />
      </div>
    </section>
  `,
})
export class EmptyState {
  readonly icon = input('inbox')
  readonly heading = input.required<string>()
  readonly message = input('')
}
