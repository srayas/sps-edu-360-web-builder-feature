import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core'
import { MatCardModule } from '@angular/material/card'
import { MatIconModule } from '@angular/material/icon'
import { MatListModule } from '@angular/material/list'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import {
  Block,
  Scope,
  blockClasses,
  interpolate,
  lines,
  lookup,
  stringify,
  toneClass,
} from '../../core/model'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { BlockSkeleton } from './block-skeleton'

@Component({
  selector: 'wb-data-block',
  imports: [
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    BlockSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  template: `
    @let b = block();
    @switch (b.type) {
      @case ('stat') {
        <mat-card
          [appearance]="$any(b.props['appearance'])"
          [class]="classes()"
        >
          <mat-card-content class="ui-row ui-align-start ui-gap-4">
            <div class="ui-column ui-gap-1 ui-grow ui-min-0">
              <span class="mat-font-label-lg mat-text-on-surface-variant">{{
                t('label')
              }}</span>
              <span class="mat-font-headline-md ui-truncate">{{
                t('value')
              }}</span>
              @if (b.props['trend']) {
                <span [class]="'mat-font-body-sm ' + trendTone()">{{
                  t('trend')
                }}</span>
              }
            </div>
            @if (b.props['icon']) {
              <mat-icon
                class="wb-stat-icon mat-bg-secondary-container mat-text-on-secondary-container mat-corner-md"
                aria-hidden="true"
                >{{ b.props['icon'] }}</mat-icon
              >
            }
          </mat-card-content>
        </mat-card>
      }
      @case ('data-list') {
        @if (loading()) {
          <wb-block-skeleton
            [class]="classes()"
            type="data-list"
            [label]="b.name"
            [count]="3"
          />
        } @else {
          <mat-list [class]="classes() + ' ui-enter'">
            @for (item of listItems(); track $index) {
              <mat-list-item>
                <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                <span matListItemTitle>{{ item.title }}</span>
                @if (item.subtitle) {
                  <span matListItemLine>{{ item.subtitle }}</span>
                }
              </mat-list-item>
            } @empty {
              <mat-list-item
                ><span matListItemTitle class="mat-text-on-surface-variant"
                  >No items</span
                ></mat-list-item
              >
            }
          </mat-list>
        }
      }
      @case ('progress') {
        <div [class]="classes() + ' ui-column ui-gap-2'">
          @if (b.props['label']) {
            <div class="ui-row ui-justify-between mat-font-body-md">
              <span [id]="b.id + '-label'">{{ t('label') }}</span>
              @if (b.props['mode'] !== 'indeterminate') {
                <span class="mat-text-on-surface-variant">{{ value() }}%</span>
              }
            </div>
          }
          @if (b.props['shape'] === 'spinner') {
            <mat-progress-spinner
              [mode]="
                b.props['mode'] === 'indeterminate'
                  ? 'indeterminate'
                  : 'determinate'
              "
              [value]="value()"
              diameter="48"
              [attr.aria-labelledby]="b.id + '-label'"
            />
          } @else {
            <mat-progress-bar
              [mode]="$any(b.props['mode'])"
              [value]="value()"
              [bufferValue]="value() + 15"
              [attr.aria-labelledby]="b.id + '-label'"
            />
          }
        </div>
      }
    }
  `,
})
export class DataBlock {
  readonly block = input.required<Block>()
  readonly scope = input.required<Scope>()
  private readonly runtime = inject(SiteRuntime)

  readonly classes = computed(() => blockClasses(this.block()))
  readonly loading = computed(
    () =>
      !!this.block().props['source'] &&
      this.runtime.isLoading(String(this.block().props['source'])),
  )
  readonly trendTone = computed(() =>
    toneClass(this.block().props['trendTone']),
  )
  readonly value = computed(() =>
    Math.max(0, Math.min(100, Number(this.t('value')) || 0)),
  )
  readonly listItems = computed(() => {
    const props = this.block().props
    const source = String(props['source'] ?? '')
    const fallbackIcon = String(props['icon'] || 'label')
    if (source) {
      return this.runtime
        .rowsFor(source)
        .slice(0, 200)
        .map((row) => ({
          title: stringify(lookup(row, String(props['titleField'] || 'name'))),
          subtitle: stringify(
            lookup(row, String(props['subtitleField'] || '')),
          ),
          icon:
            stringify(lookup(row, String(props['iconField'] || ''))) ||
            fallbackIcon,
        }))
    }
    return lines(interpolate(props['items'], this.scope())).map(
      ([title, subtitle = '', icon = '']) => ({
        title,
        subtitle,
        icon: icon || fallbackIcon,
      }),
    )
  })

  t(key: string): string {
    return interpolate(this.block().props[key], this.scope())
  }
}
