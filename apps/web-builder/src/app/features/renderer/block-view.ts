import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from '@angular/core'
import { MatCardModule } from '@angular/material/card'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatTabsModule } from '@angular/material/tabs'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatStepperModule } from '@angular/material/stepper'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatTooltipModule } from '@angular/material/tooltip'
import {
  Block,
  Scope,
  blockClasses,
  blockLayoutClasses,
  interpolate,
  isFormField,
  safeUrl,
} from '../../core/model'
import { EDITOR_BRIDGE } from '../../core/runtime/editor-bridge'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { blockState } from '../../core/runtime/block-state'
import { BlockList } from './block-list'
import { ContentBlock } from './content-block'
import { FieldBlock } from './field-block'
import { DataBlock } from './data-block'
import { NavBlock } from './nav-block'
import { TableBlock } from './table-block'
import { ChartBlock } from './chart-block'
import { FormBlock } from './form-block'
import { BlockSkeleton } from './block-skeleton'

const CONTENT = new Set([
  'heading',
  'text',
  'image',
  'video',
  'audio',
  'embed',
  'button',
  'link',
  'icon',
  'list',
  'quote',
  'code',
  'chips',
  'avatar',
  'divider',
  'spacer',
  'alert',
  'badge',
])
const NAV = new Set(['nav', 'nav-list', 'menu', 'breadcrumbs'])
const DATA = new Set(['data-list', 'stat', 'progress'])

/** Renders one block. Containers render their children through `wb-block-list`. */
@Component({
  selector: 'wb-block',
  imports: [
    MatCardModule,
    MatToolbarModule,
    MatTabsModule,
    MatExpansionModule,
    MatStepperModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    forwardRef(() => BlockList),
    ContentBlock,
    FieldBlock,
    DataBlock,
    NavBlock,
    TableBlock,
    ChartBlock,
    forwardRef(() => FormBlock),
    BlockSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  templateUrl: './block-view.html',
})
export class BlockView {
  /** The block as authored. */
  readonly source = input.required<Block>({ alias: 'block' })
  readonly scope = input.required<Scope>()
  readonly depth = input(0)
  /** Set when a containing block is disabled by logic or rules. */
  readonly disabled = input(false)

  readonly runtime = inject(SiteRuntime)
  private readonly editor = inject(EDITOR_BRIDGE, { optional: true })

  /** Effective state: bindings, page rules and inherited disabled state applied. */
  readonly state = blockState(
    this.runtime,
    this.source,
    this.scope,
    this.disabled,
  )
  /** The block with computed properties applied; what the template renders. */
  readonly block = computed(() => this.state().block)

  readonly editing = computed(
    () => !!this.editor && this.runtime.mode() === 'edit',
  )
  readonly visible = computed(() => this.editing() || this.state().visible)
  /** While editing, blocks hidden by logic stay visible but dimmed and labelled. */
  readonly hiddenByLogic = computed(
    () => this.editing() && !this.state().visible,
  )
  readonly childrenDisabled = computed(() => !this.state().enabled)
  readonly classes = computed(() => blockClasses(this.block()))
  readonly layout = computed(() => blockLayoutClasses(this.block()))
  readonly kind = computed(() => {
    const type = this.block().type
    if (CONTENT.has(type)) return 'content'
    if (NAV.has(type)) return 'nav'
    if (DATA.has(type)) return 'data'
    if (isFormField(type)) return 'field'
    return type
  })

  /** Rows rendered by a Repeater, each with its own `item` scope. */
  readonly items = computed(() => {
    const block = this.block()
    if (block.type !== 'repeater') return []
    const rows = this.runtime.rowsFor(String(block.props['source']))
    const limit = Number(block.props['limit']) || rows.length
    return rows
      .slice(0, limit)
      .map((item, index) => ({ ...this.scope(), item, index }))
  })
  readonly repeaterLoading = computed(
    () =>
      this.block().type === 'repeater' &&
      this.runtime.isLoading(String(this.block().props['source'])),
  )
  readonly sampleScope = computed(
    () => this.items()[0] ?? { ...this.scope(), item: {}, index: 0 },
  )

  t(key: string, block = this.block()): string {
    return interpolate(block.props[key], this.scope())
  }
  bool(key: string, block = this.block()): boolean {
    return block.props[key] === true
  }
  media(key: string): string {
    return safeUrl(this.t(key), true)
  }
  classesOf(block: Block): string {
    return blockClasses(block)
  }
  layoutOf(block: Block): string {
    return blockLayoutClasses(block)
  }
  show(block: Block): boolean {
    return this.editing() || this.runtime.isVisible(block)
  }

  click(event: Event): void {
    if (this.editing()) return
    event.stopPropagation()
    void this.runtime.run(this.block().actions, 'click', {
      scope: this.scope(),
    })
  }

  /** Card clicks run actions only when the card has some, so clicks on its contents are never swallowed. */
  cardClick(event: Event): void {
    if (this.hasClick()) this.click(event)
  }

  hasClick(): boolean {
    return (
      this.runtime.hasActions(this.block().actions, 'click') && !this.editing()
    )
  }

  selectChild(event: Event, id: string): void {
    if (!this.editing()) return
    event.stopPropagation()
    this.editor?.select(id)
  }
}
