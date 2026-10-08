import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core'
import {
  Block,
  Scope,
  blockClasses,
  interpolate,
  lines,
  lookup,
  stringify,
} from '../../core/model'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { BlockSkeleton } from './block-skeleton'

interface Point {
  label: string
  value: number
}

const WIDTH = 600
const HEIGHT = 260
const PAD = { top: 16, right: 16, bottom: 32, left: 44 }

/**
 * Dependency-free SVG chart. Geometry is expressed with SVG attributes; colors come from theme
 * tokens through classes, so charts follow the project palette in light and dark mode.
 */
@Component({
  selector: 'wb-chart-block',
  imports: [BlockSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  template: `
    @let b = block();
    @if (loading()) {
      <wb-block-skeleton [class]="classes()" type="chart" [label]="b.name" />
    } @else {
      <figure [class]="classes() + ' wb-chart ui-column ui-gap-2 ui-enter'">
        @if (b.props['title']) {
          <figcaption class="mat-font-title-md">{{ t('title') }}</figcaption>
        }
        @if (points().length) {
          <svg
            [attr.viewBox]="'0 0 ' + width + ' ' + height"
            role="img"
            [attr.aria-label]="summary()"
            class="wb-chart-svg"
          >
            @for (tick of ticks(); track $index) {
              <line
                class="wb-chart-grid"
                [attr.x1]="pad.left"
                [attr.x2]="width - pad.right"
                [attr.y1]="tick.y"
                [attr.y2]="tick.y"
              />
              <text
                class="wb-chart-axis"
                [attr.x]="pad.left - 8"
                [attr.y]="tick.y + 4"
                text-anchor="end"
              >
                {{ tick.label }}
              </text>
            }
            @if (b.props['chartType'] === 'line') {
              <path class="wb-chart-area" [attr.d]="area()" />
              <path class="wb-chart-line" [attr.d]="line()" />
              @for (bar of bars(); track $index) {
                <circle
                  class="wb-chart-dot"
                  [attr.cx]="bar.cx"
                  [attr.cy]="bar.y"
                  r="4"
                >
                  <title>{{ bar.label }}: {{ bar.value }}</title>
                </circle>
              }
            } @else {
              @for (bar of bars(); track $index) {
                <rect
                  class="wb-chart-bar"
                  [attr.x]="bar.x"
                  [attr.y]="bar.y"
                  [attr.width]="bar.width"
                  [attr.height]="bar.height"
                  rx="4"
                >
                  <title>{{ bar.label }}: {{ bar.value }}</title>
                </rect>
              }
            }
            @for (bar of bars(); track $index) {
              <text
                class="wb-chart-axis"
                [attr.x]="bar.cx"
                [attr.y]="height - 10"
                text-anchor="middle"
              >
                {{ bar.label }}
              </text>
            }
          </svg>
        } @else {
          <p class="mat-font-body-md mat-text-on-surface-variant">
            No data to chart.
          </p>
        }
      </figure>
    }
  `,
})
export class ChartBlock {
  readonly block = input.required<Block>()
  readonly scope = input.required<Scope>()
  private readonly runtime = inject(SiteRuntime)
  readonly width = WIDTH
  readonly height = HEIGHT
  readonly pad = PAD

  readonly classes = computed(() => blockClasses(this.block()))
  readonly loading = computed(
    () =>
      !!this.block().props['source'] &&
      this.runtime.isLoading(String(this.block().props['source'])),
  )
  readonly points = computed<Point[]>(() => {
    const props = this.block().props
    const source = String(props['source'] ?? '')
    const raw = source
      ? this.runtime.rowsFor(source).map((row) => ({
          label: stringify(lookup(row, String(props['labelField'] || 'label'))),
          value: Number(lookup(row, String(props['valueField'] || 'value'))),
        }))
      : lines(interpolate(props['items'], this.scope())).map(
          ([label, value]) => ({ label, value: Number(value) }),
        )
    return raw.filter((point) => Number.isFinite(point.value)).slice(0, 40)
  })
  private readonly max = computed(() => {
    const max = Math.max(0, ...this.points().map((point) => point.value))
    if (max === 0) return 1
    const magnitude = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / magnitude) * magnitude
  })
  readonly ticks = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
      y: PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - fraction),
      label: (this.max() * fraction).toLocaleString(undefined, {
        maximumFractionDigits: 1,
      }),
    })),
  )
  readonly bars = computed(() => {
    const points = this.points()
    const plotWidth = WIDTH - PAD.left - PAD.right
    const plotHeight = HEIGHT - PAD.top - PAD.bottom
    const slot = plotWidth / Math.max(points.length, 1)
    return points.map((point, index) => {
      const height = (Math.max(point.value, 0) / this.max()) * plotHeight
      return {
        ...point,
        x: PAD.left + slot * index + slot * 0.2,
        width: slot * 0.6,
        cx: PAD.left + slot * index + slot / 2,
        y: PAD.top + plotHeight - height,
        height,
      }
    })
  })
  readonly line = computed(() =>
    this.bars()
      .map((bar, index) => `${index ? 'L' : 'M'}${bar.cx},${bar.y}`)
      .join(' '),
  )
  readonly area = computed(() => {
    const bars = this.bars()
    if (!bars.length) return ''
    const base = HEIGHT - PAD.bottom
    return `${this.line()} L${bars.at(-1)!.cx},${base} L${bars[0].cx},${base} Z`
  })
  readonly summary = computed(
    () =>
      `${this.t('title') || 'Chart'}: ${this.points()
        .map((point) => `${point.label} ${point.value}`)
        .join(', ')}`,
  )

  t(key: string): string {
    return interpolate(this.block().props[key], this.scope())
  }
}
