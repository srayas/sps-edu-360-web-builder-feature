import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core'

export type SkeletonShape =
  | 'text'
  | 'title'
  | 'paragraph'
  | 'field'
  | 'button'
  | 'avatar'
  | 'image'
  | 'card'
  | 'list'
  | 'table'
  | 'chart'
  | 'stat'
  | 'section'
  | 'panel'
  | 'page'

/**
 * Placeholder that mirrors the shape of the content it stands in for, so layout doesn't jump
 * when real content arrives. Purely presentational: screen readers get one "Loading" status.
 */
@Component({
  selector: 'ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-skeleton-host',
    role: 'status',
    '[attr.aria-label]': 'label()',
    'aria-busy': 'true',
  },
  template: `
    @switch (shape()) {
      @case ('text') {
        <span class="ui-sk ui-sk-line ui-sk-w-75"></span>
      }
      @case ('title') {
        <span class="ui-sk ui-sk-title ui-sk-w-50"></span>
      }
      @case ('paragraph') {
        <div class="ui-column ui-gap-2">
          @for (line of rows(); track $index; let last = $last) {
            <span
              class="ui-sk ui-sk-line"
              [class.ui-sk-w-60]="last"
              [class.ui-sk-w-100]="!last"
            ></span>
          }
        </div>
      }
      @case ('field') {
        <div class="ui-column ui-gap-2">
          <span class="ui-sk ui-sk-label ui-sk-w-25"></span>
          <span class="ui-sk ui-sk-field"></span>
        </div>
      }
      @case ('button') {
        <span class="ui-sk ui-sk-button"></span>
      }
      @case ('avatar') {
        <div class="ui-row ui-align-center ui-gap-3">
          <span class="ui-sk ui-sk-circle"></span>
          <div class="ui-column ui-gap-2 ui-grow">
            <span class="ui-sk ui-sk-line ui-sk-w-50"></span>
            <span class="ui-sk ui-sk-line ui-sk-w-25"></span>
          </div>
        </div>
      }
      @case ('image') {
        <span class="ui-sk ui-sk-media"></span>
      }
      @case ('card') {
        <div class="ui-sk-card ui-column ui-gap-3 ui-p-4">
          <span class="ui-sk ui-sk-media"></span>
          <span class="ui-sk ui-sk-title ui-sk-w-60"></span>
          <span class="ui-sk ui-sk-line ui-sk-w-100"></span>
          <span class="ui-sk ui-sk-line ui-sk-w-75"></span>
        </div>
      }
      @case ('stat') {
        <div class="ui-sk-card ui-column ui-gap-2 ui-p-4">
          <span class="ui-sk ui-sk-line ui-sk-w-40"></span>
          <span class="ui-sk ui-sk-title ui-sk-w-60"></span>
          <span class="ui-sk ui-sk-line ui-sk-w-25"></span>
        </div>
      }
      @case ('list') {
        <div class="ui-column ui-gap-4">
          @for (line of rows(); track $index) {
            <div class="ui-row ui-align-center ui-gap-3">
              <span class="ui-sk ui-sk-circle ui-sk-sm"></span>
              <div class="ui-column ui-gap-2 ui-grow">
                <span class="ui-sk ui-sk-line ui-sk-w-60"></span>
                <span class="ui-sk ui-sk-line ui-sk-w-40"></span>
              </div>
            </div>
          }
        </div>
      }
      @case ('table') {
        <div class="ui-sk-card ui-column">
          <div class="ui-row ui-gap-4 ui-p-4 ui-divider-bottom">
            @for (cell of columns(); track $index) {
              <span class="ui-sk ui-sk-line ui-grow"></span>
            }
          </div>
          @for (row of rows(); track $index) {
            <div class="ui-row ui-gap-4 ui-p-4 ui-divider-bottom">
              @for (cell of columns(); track $index) {
                <span class="ui-sk ui-sk-line ui-grow ui-sk-soft"></span>
              }
            </div>
          }
        </div>
      }
      @case ('chart') {
        <div class="ui-column ui-gap-3">
          <span class="ui-sk ui-sk-line ui-sk-w-40"></span>
          <div class="ui-sk-bars">
            @for (bar of bars; track $index) {
              <span [class]="'ui-sk ui-sk-bar ui-sk-h-' + bar"></span>
            }
          </div>
        </div>
      }
      @case ('section') {
        <div class="ui-column ui-gap-4 ui-py-6">
          <span class="ui-sk ui-sk-title ui-sk-w-40"></span>
          <span class="ui-sk ui-sk-line ui-sk-w-75"></span>
          <div class="ui-grid ui-cols-3 ui-gap-4 ui-sk-grid">
            @for (card of [1, 2, 3]; track card) {
              <div class="ui-sk-card ui-column ui-gap-2 ui-p-4">
                <span class="ui-sk ui-sk-line ui-sk-w-60"></span>
                <span class="ui-sk ui-sk-line ui-sk-w-100"></span>
              </div>
            }
          </div>
        </div>
      }
      @case ('panel') {
        <div class="ui-column ui-gap-4 ui-p-3">
          <span class="ui-sk ui-sk-field"></span>
          @for (row of rows(); track $index) {
            <div class="ui-column ui-gap-2">
              <span class="ui-sk ui-sk-label ui-sk-w-40"></span>
              <span class="ui-sk ui-sk-field"></span>
            </div>
          }
        </div>
      }
      @case ('page') {
        <div class="ui-column ui-gap-6 ui-p-5">
          <span class="ui-sk ui-sk-title ui-sk-w-25"></span>
          <div class="ui-grid ui-cols-auto ui-gap-4">
            @for (card of [1, 2, 3, 4]; track card) {
              <div class="ui-sk-card ui-column ui-gap-3 ui-p-4">
                <span class="ui-sk ui-sk-media"></span>
                <span class="ui-sk ui-sk-line ui-sk-w-60"></span>
                <span class="ui-sk ui-sk-line ui-sk-w-40"></span>
              </div>
            }
          </div>
        </div>
      }
    }
  `,
})
export class Skeleton {
  readonly shape = input<SkeletonShape>('paragraph')
  /** Number of lines / rows for paragraph, list, table and panel shapes. */
  readonly count = input(3)
  readonly cols = input(4)
  readonly label = input('Loading')
  readonly rows = computed(() =>
    Array.from({ length: Math.max(1, Math.min(this.count(), 12)) }),
  )
  readonly columns = computed(() =>
    Array.from({ length: Math.max(1, Math.min(this.cols(), 8)) }),
  )
  readonly bars = [40, 70, 55, 85, 60, 95, 75]
}
