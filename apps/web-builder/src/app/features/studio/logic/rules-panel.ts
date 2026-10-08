import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatDividerModule } from '@angular/material/divider'
import { EmptyState } from '@spsedu360/shared-ui'
import { truthy } from '@spsedu360/json-logic'
import {
  Block,
  EffectKind,
  Expr,
  PageRule,
  RuleEffect,
  definition,
  evaluateExpr,
  findBlock,
  isContainer,
  isFormField,
} from '../../../core/model'
import { SiteRuntime } from '../../../core/runtime/site-runtime'
import { BuilderStore } from '../builder-store'
import { ExprEditor } from './expr-editor'
import { scopePaths } from './scope-paths'

const EFFECT_LABELS: Record<EffectKind, string> = {
  show: 'Show',
  hide: 'Hide',
  enable: 'Enable',
  disable: 'Disable',
  require: 'Make required',
  optional: 'Make optional',
  'set-value': 'Set value (once)',
  'set-prop': 'Set property',
}

/**
 * Page rules: one condition drives many blocks — show or hide sections, enable or disable groups
 * of fields, require fields, set values or properties. Rules apply in order; later rules win.
 */
@Component({
  selector: 'wb-rules-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatDividerModule,
    EmptyState,
    ExprEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column ui-gap-3 ui-p-3">
      <div class="ui-row ui-align-center ui-gap-2">
        <div class="ui-column ui-grow">
          <h2 class="mat-font-title-md ui-m-0">Page rules</h2>
          <span class="mat-font-body-sm mat-text-on-surface-variant"
            >One condition, many blocks. Later rules win.</span
          >
        </div>
        <button matButton="tonal" type="button" (click)="store.addRule()">
          <mat-icon>add</mat-icon>Rule
        </button>
      </div>
      <mat-accordion displayMode="flat" multi>
        @for (
          rule of store.page().rules;
          track rule.id;
          let first = $first;
          let last = $last
        ) {
          <mat-expansion-panel [expanded]="last">
            <mat-expansion-panel-header>
              <mat-panel-title class="ui-gap-2"
                ><mat-icon class="ui-icon-sm">{{
                  rule.enabled ? 'bolt' : 'block'
                }}</mat-icon
                >{{ rule.name }}</mat-panel-title
              >
              <mat-panel-description>
                @if (state()[rule.id] !== undefined) {
                  <span class="wb-logic-chip">{{
                    state()[rule.id] ? 'active now' : 'inactive'
                  }}</span>
                }
              </mat-panel-description>
            </mat-expansion-panel-header>
            <div class="ui-column ui-gap-3">
              <div class="ui-row ui-gap-2 ui-align-center">
                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="ui-grow"
                >
                  <mat-label>Rule name</mat-label>
                  <input
                    matInput
                    [value]="rule.name"
                    (input)="
                      store.updateRule(rule.id, {
                        name: $any($event.target).value,
                      })
                    "
                  />
                </mat-form-field>
                <mat-slide-toggle
                  [checked]="rule.enabled"
                  (change)="
                    store.updateRule(rule.id, { enabled: $event.checked })
                  "
                  aria-label="Rule enabled"
                />
              </div>
              <span class="mat-font-label-lg">When</span>
              <wb-expr-editor
                [expr]="rule.when"
                purpose="condition"
                [paths]="paths()"
                [valuePaths]="paths()"
                [scope]="runtime.scope()"
                [clearable]="false"
                (exprChange)="setWhen(rule, $event)"
              />
              @for (branch of branches; track branch.key) {
                <mat-divider />
                <div class="ui-row ui-align-center">
                  <span class="mat-font-label-lg ui-grow">{{
                    branch.label
                  }}</span>
                  <button
                    matButton
                    type="button"
                    (click)="
                      store.addEffect(rule.id, branch.key, defaultTarget())
                    "
                  >
                    <mat-icon>add</mat-icon>Effect
                  </button>
                </div>
                @for (effect of rule[branch.key]; track effect.id) {
                  <div class="wb-condition ui-column ui-gap-2">
                    <div class="ui-row ui-gap-2 ui-align-start">
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="ui-grow"
                      >
                        <mat-label>Block</mat-label>
                        <mat-select
                          [value]="effect.target"
                          (selectionChange)="
                            store.updateEffect(rule.id, branch.key, effect.id, {
                              target: $event.value,
                            })
                          "
                        >
                          @for (layer of store.layers(); track layer.block.id) {
                            <mat-option [value]="layer.block.id"
                              >{{ '— '.repeat(layer.depth)
                              }}{{ layer.block.name }}</mat-option
                            >
                          }
                        </mat-select>
                      </mat-form-field>
                      <button
                        matIconButton
                        type="button"
                        class="wb-icon-button-sm"
                        matTooltip="Remove effect"
                        aria-label="Remove effect"
                        (click)="
                          store.removeEffect(rule.id, branch.key, effect.id)
                        "
                      >
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                    >
                      <mat-label>Effect</mat-label>
                      <mat-select
                        [value]="effect.kind"
                        (selectionChange)="
                          setKind(rule, branch.key, effect, $event.value)
                        "
                      >
                        @for (kind of kindsFor(effect.target); track kind) {
                          <mat-option [value]="kind">{{
                            labels[kind]
                          }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    @if (effect.kind === 'set-prop') {
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                      >
                        <mat-label>Property</mat-label>
                        <mat-select
                          [value]="effect.prop"
                          (selectionChange)="
                            store.updateEffect(rule.id, branch.key, effect.id, {
                              prop: $event.value,
                            })
                          "
                        >
                          @for (
                            prop of propsFor(effect.target);
                            track prop.key
                          ) {
                            <mat-option [value]="prop.key">{{
                              prop.label
                            }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    }
                    @if (
                      effect.kind === 'set-prop' || effect.kind === 'set-value'
                    ) {
                      <wb-expr-editor
                        [expr]="effect.value"
                        purpose="value"
                        [paths]="paths()"
                        [scope]="runtime.scope()"
                        [clearable]="false"
                        (exprChange)="
                          store.updateEffect(rule.id, branch.key, effect.id, {
                            value: $event,
                          })
                        "
                      />
                    }
                  </div>
                } @empty {
                  <p
                    class="mat-font-body-sm mat-text-on-surface-variant ui-m-0"
                  >
                    Nothing happens.
                  </p>
                }
              }
              <mat-divider />
              <div class="ui-row ui-gap-1">
                <button
                  matIconButton
                  type="button"
                  matTooltip="Move up"
                  aria-label="Move rule up"
                  [disabled]="first"
                  (click)="store.moveRule(rule.id, -1)"
                >
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button
                  matIconButton
                  type="button"
                  matTooltip="Move down"
                  aria-label="Move rule down"
                  [disabled]="last"
                  (click)="store.moveRule(rule.id, 1)"
                >
                  <mat-icon>arrow_downward</mat-icon>
                </button>
                <span class="ui-spacer"></span>
                <button
                  matButton
                  type="button"
                  (click)="store.removeRule(rule.id)"
                >
                  <mat-icon>delete_outline</mat-icon>Delete rule
                </button>
              </div>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>
      @if (!store.page().rules.length) {
        <ui-empty-state
          icon="account_tree"
          heading="No rules on this page"
          message="Example: when “Account type” is “Business”, show the Company section and require “VAT number”."
        />
      }
    </div>
  `,
})
export class RulesPanel {
  readonly store = inject(BuilderStore)
  readonly runtime = inject(SiteRuntime)
  readonly labels = EFFECT_LABELS
  readonly branches = [
    { key: 'effects' as const, label: 'Then' },
    { key: 'otherwise' as const, label: 'Otherwise' },
  ]

  readonly paths = computed(() =>
    scopePaths(this.store.project(), this.store.page(), (id) =>
      Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
    ),
  )
  /** Live state of each rule against the page as it is now (helps while building). */
  readonly state = computed(() => {
    const scope = this.runtime.scope()
    const out: Record<string, boolean> = {}
    for (const rule of this.store.page().rules)
      out[rule.id] =
        rule.enabled && truthy(evaluateExpr(rule.when, scope, false))
    return out
  })

  setWhen(rule: PageRule, expr: Expr | undefined): void {
    if (expr) this.store.updateRule(rule.id, { when: expr })
  }

  defaultTarget(): string {
    return this.store.selectedId() || this.store.layers()[0]?.block.id || ''
  }

  private block(id: string): Block | undefined {
    return findBlock(this.store.page().blocks, id)
  }

  kindsFor(id: string): EffectKind[] {
    const block = this.block(id)
    const kinds: EffectKind[] = ['show', 'hide']
    if (!block) return kinds
    if (
      isContainer(block.type) ||
      isFormField(block.type) ||
      ['button', 'link', 'menu', 'card'].includes(block.type)
    )
      kinds.push('enable', 'disable')
    if (isFormField(block.type)) kinds.push('require', 'optional', 'set-value')
    kinds.push('set-prop')
    return kinds
  }

  propsFor(id: string) {
    const block = this.block(id)
    return (definition(block?.type ?? '')?.props ?? []).filter(
      (prop) =>
        prop.kind !== 'source' && prop.key !== 'field' && prop.key !== 'bind',
    )
  }

  setKind(
    rule: PageRule,
    branch: 'effects' | 'otherwise',
    effect: RuleEffect,
    kind: EffectKind,
  ): void {
    const needsValue = kind === 'set-prop' || kind === 'set-value'
    this.store.updateEffect(rule.id, branch, effect.id, {
      kind,
      value: needsValue
        ? (effect.value ?? { kind: 'template', text: '' })
        : undefined,
      prop:
        kind === 'set-prop'
          ? (effect.prop ?? this.propsFor(effect.target)[0]?.key)
          : undefined,
    })
  }
}
