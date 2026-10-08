import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/** Page title row with an optional description and projected actions. */
@Component({
  selector: 'ui-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="ui-row ui-wrap ui-align-end ui-justify-between ui-gap-4 ui-mb-5"
    >
      <div class="ui-column ui-gap-1 ui-min-0">
        <h1 class="mat-font-headline-md ui-m-0">{{ heading() }}</h1>
        @if (description()) {
          <p class="mat-font-body-lg mat-text-on-surface-variant ui-m-0">
            {{ description() }}
          </p>
        }
      </div>
      <div class="ui-row ui-wrap ui-gap-2"><ng-content /></div>
    </header>
  `,
})
export class PageHeader {
  readonly heading = input.required<string>()
  readonly description = input('')
}
