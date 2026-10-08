import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core'
import { MatTabsModule } from '@angular/material/tabs'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatMenuModule } from '@angular/material/menu'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatChipsModule } from '@angular/material/chips'
import { MatDividerModule } from '@angular/material/divider'
import { EmptyState } from '@spsedu360/shared-ui'
import {
  ACTION_DEFINITIONS,
  Block,
  PropDef,
  STYLE_GROUPS,
  StyleGroup,
  StyleProperty,
  StyleScope,
  THEME_COLORS,
  TRIGGER_LABELS,
  Trigger,
  Viewport,
  definition,
  hasOverrides,
  isContainer,
  isFormField,
  safeStyle,
} from '../../core/model'
import { BuilderStore } from './builder-store'
import { PropField } from './prop-field'
import { ActionEditor } from './action-editor'
import { BlockLogicPanel } from './logic/block-logic-panel'

const SECTIONS: { key: PropDef['section']; label: string }[] = [
  { key: 'content', label: 'Content' },
  { key: 'data', label: 'Data' },
  { key: 'layout', label: 'Layout' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'behaviour', label: 'Behaviour' },
]

/** Right-hand panel: edits the selected block's properties, style overrides and behaviour. */
@Component({
  selector: 'wb-inspector',
  imports: [
    MatTabsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatExpansionModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    EmptyState,
    PropField,
    ActionEditor,
    BlockLogicPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspector.html',
})
export class Inspector {
  readonly store = inject(BuilderStore)
  readonly scope = signal<StyleScope>('styles')
  readonly styleGroups = STYLE_GROUPS
  readonly themeColors = THEME_COLORS
  readonly actionTypes = ACTION_DEFINITIONS
  readonly triggerLabels = TRIGGER_LABELS
  readonly viewports: Viewport[] = ['desktop', 'tablet', 'mobile']
  readonly styleError = signal<Record<string, string>>({})

  readonly definition = computed(() => {
    const block = this.store.selected()
    return block ? definition(block.type) : undefined
  })
  readonly sections = computed(() => {
    const block = this.store.selected()
    const def = this.definition()
    if (!block || !def) return []
    return SECTIONS.map((section) => ({
      ...section,
      props: def.props.filter(
        (prop) =>
          prop.section === section.key &&
          (!prop.when || prop.when.values.includes(block.props[prop.when.key])),
      ),
    })).filter((section) => section.props.length)
  })
  readonly childType = computed(() => {
    const accepts = this.definition()?.accepts
    return accepts?.length === 1 ? definition(accepts[0]) : undefined
  })
  readonly triggers = computed<Trigger[]>(() => {
    const block = this.store.selected()
    if (!block) return []
    const events = [...(this.definition()?.events ?? [])]
    if (isFormField(block.type) && !events.includes('change'))
      events.push('change')
    return events
  })
  readonly hasLogic = computed(() => {
    const block = this.store.selected()
    return (
      !!block &&
      (Object.keys(block.logic).length > 0 || block.actions.length > 0)
    )
  })
  readonly overridden = computed(() => {
    const block = this.store.selected()
    return !!block && hasOverrides(block)
  })

  isContainer(block: Block): boolean {
    return isContainer(block.type)
  }
  actionsFor(block: Block, trigger: Trigger) {
    return block.actions.filter((action) => action.trigger === trigger)
  }
  hasGroupOverrides(block: Block, group: StyleGroup): boolean {
    return group.properties.some((item) => !!block[this.scope()][item.property])
  }
  styleValue(block: Block, property: string): string {
    return block[this.scope()][property] ?? ''
  }
  isThemeColor(value: string): boolean {
    return THEME_COLORS.some((color) => color.value === value)
  }
  scopeCount(block: Block, scope: StyleScope): number {
    return Object.keys(block[scope]).length
  }

  setStyle(item: StyleProperty, value: string): void {
    const trimmed = value.trim()
    const key = `${this.scope()}:${item.property}`
    if (
      trimmed &&
      (!safeStyle(item.property, trimmed) ||
        (typeof CSS !== 'undefined' && !CSS.supports(item.property, trimmed)))
    ) {
      this.styleError.update((errors) => ({
        ...errors,
        [key]: 'Not a valid value for this property',
      }))
      return
    }
    this.styleError.update((errors) => {
      const next = { ...errors }
      delete next[key]
      return next
    })
    this.store.setStyle(this.scope(), item.property, trimmed)
  }

  pickColor(item: StyleProperty, value: string): void {
    if (value !== 'custom') this.setStyle(item, value)
  }

  error(property: string): string {
    return this.styleError()[`${this.scope()}:${property}`] ?? ''
  }

  toggleHide(block: Block, viewport: Viewport, hidden: boolean): void {
    const hideOn = hidden
      ? [...new Set([...block.visibility.hideOn, viewport])]
      : block.visibility.hideOn.filter((item) => item !== viewport)
    this.store.updateVisibility({ hideOn })
  }
}
