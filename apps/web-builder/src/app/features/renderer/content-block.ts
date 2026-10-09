import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core'
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'
import { MatButtonModule, MatButtonAppearance } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatChipsModule } from '@angular/material/chips'
import { MatDividerModule } from '@angular/material/divider'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import {
  Block,
  Scope,
  blockClasses,
  interpolate,
  lines,
  safeUrl,
  surfaceClasses,
} from '../../core/model'
import { FormScope } from '../../core/runtime/form-scope'
import { SiteRuntime } from '../../core/runtime/site-runtime'

const APPEARANCES: readonly string[] = [
  'filled',
  'tonal',
  'outlined',
  'elevated',
  'text',
]

@Component({
  selector: 'wb-content-block',
  imports: [
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  templateUrl: './content-block.html',
})
export class ContentBlock {
  readonly block = input.required<Block>()
  readonly scope = input.required<Scope>()

  readonly runtime = inject(SiteRuntime)
  private readonly form = inject(FormScope, { optional: true })
  /** True while this button's actions run (or its form submits): shows progress, blocks repeats. */
  readonly busy = signal(false)
  readonly working = computed(
    () =>
      this.busy() ||
      (this.block().props['htmlType'] === 'submit' && !!this.form?.busy()),
  )
  private readonly sanitizer = inject(DomSanitizer)

  readonly classes = computed(() => blockClasses(this.block()))
  readonly dismissed = signal(false)
  readonly imageLoaded = signal(false)
  readonly badgeTone = computed(() =>
    surfaceClasses(String(this.block().props['surface'])).join(' '),
  )
  readonly level = computed(() =>
    /^[1-6]$/.test(String(this.block().props['level']))
      ? String(this.block().props['level'])
      : '2',
  )
  readonly appearance = computed<MatButtonAppearance | null>(() => {
    const variant = String(this.block().props['variant'])
    return APPEARANCES.includes(variant)
      ? (variant as MatButtonAppearance)
      : null
  })
  readonly items = computed(() =>
    lines(interpolate(this.block().props['items'], this.scope())).map(
      ([item]) => item,
    ),
  )
  readonly initials = computed(() =>
    this.t('name')
      .split(/\s+/)
      .map((word) => word[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  )

  /** Embeds are limited to https and sandboxed; the URL is still re-validated before trusting it. */
  readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const url = safeUrl(this.block().props['src'], true)
    return url.startsWith('https://')
      ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
      : null
  })

  t(key: string): string {
    return interpolate(this.block().props[key], this.scope())
  }
  bool(key: string): boolean {
    return this.block().props[key] === true
  }
  media(key: string): string {
    return safeUrl(this.t(key), true)
  }
  href(): string {
    return safeUrl(this.t('href'))
  }

  activate(event: Event): void {
    const block = this.block()
    if (this.runtime.mode() === 'edit') {
      event.preventDefault()
      return
    }
    if (block.type === 'link' || (block.type === 'button' && this.href())) {
      const href = this.href()
      if (href.startsWith('#')) {
        event.preventDefault()
        const page = this.runtime
          .project()
          .pages.find((item) => `#${item.slug}` === href)
        if (page)
          this.runtime.run(
            [
              {
                id: 'nav',
                trigger: 'click',
                type: 'navigate',
                target: page.id,
                value: '',
              },
            ],
            'click',
            { scope: this.scope() },
          )
        else
          this.runtime.run(
            [
              {
                id: 'anchor',
                trigger: 'click',
                type: 'openUrl',
                target: href,
                value: '',
              },
            ],
            'click',
            { scope: this.scope() },
          )
      }
    }
    if (block.actions.length) {
      if (
        block.props['htmlType'] !== 'submit' &&
        block.props['htmlType'] !== 'reset'
      )
        event.preventDefault()
      if (this.busy()) return
      this.busy.set(true)
      void this.runtime
        .run(block.actions, 'click', { scope: this.scope(), form: this.form })
        .finally(() => this.busy.set(false))
    }
  }
}
