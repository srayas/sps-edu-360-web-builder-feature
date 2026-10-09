import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatTooltipModule } from '@angular/material/tooltip'
import {
  Block,
  Expr,
  TableColumn,
  VALIDATION_DEFINITIONS,
  ValidationKind,
  ValidationRule,
  createValidation,
  defaultMessage,
  fieldName,
  isFormField,
  validationDefinition,
} from '../../../core/model'
import { SiteRuntime } from '../../../core/runtime/site-runtime'
import { BuilderStore } from '../builder-store'
import { ExprEditor } from './expr-editor'
import { PathOption, scopePaths } from './scope-paths'

const PATTERN_PRESETS: { label: string; value: string }[] = [
  { label: 'Postal code (5 digits)', value: '^[0-9]{5}$' },
  { label: 'PIN code (6 digits)', value: '^[1-9][0-9]{5}$' },
  { label: 'Uppercase code, e.g. AB1234', value: '^[A-Z]{2}[0-9]{4}$' },
  { label: 'No spaces', value: '^\\S+$' },
  {
    label: 'Strong password (8+, upper, lower, digit)',
    value: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$',
  },
]

/**
 * Validation rules of the selected form field — or, with `column`, of an editable table column:
 * presets, limits, cross-field and custom checks.
 */
@Component({
  selector: 'wb-validation-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    ExprEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ui-column ui-gap-3">
      <div class="ui-row ui-align-center ui-gap-2">
        <div class="ui-column ui-grow">
          @if (column()) {
            <span class="mat-font-label-lg">Validation</span>
            <span class="mat-font-body-sm mat-text-on-surface-variant"
              >Checked on every change; invalid values are not saved.</span
            >
          } @else {
            <h3 class="mat-font-title-sm ui-m-0">Validation</h3>
            <span class="mat-font-body-sm mat-text-on-surface-variant"
              >Checked as people type and before submit. The first failing
              rule's message is shown.</span
            >
          }
        </div>
        <button matButton="tonal" type="button" [matMenuTriggerFor]="add">
          <mat-icon>add</mat-icon>Rule
        </button>
        <mat-menu #add="matMenu">
          @for (definition of available(); track definition.kind) {
            <button mat-menu-item (click)="addRule(definition.kind)">
              {{ definition.label }}
            </button>
          }
        </mat-menu>
      </div>
      @for (
        rule of rules();
        track rule.id;
        let first = $first;
        let last = $last
      ) {
        @let def = definition(rule);
        <div class="wb-action ui-column ui-gap-2 ui-p-3">
          <div class="ui-row ui-align-center ui-gap-1">
            <mat-icon class="ui-icon-sm mat-text-primary">rule</mat-icon>
            <span class="mat-font-title-sm ui-grow">{{ def?.label }}</span>
            <button
              matIconButton
              type="button"
              class="wb-icon-button-sm"
              matTooltip="Move up"
              aria-label="Move rule up"
              [disabled]="first"
              (click)="move(rule, -1)"
            >
              <mat-icon>arrow_upward</mat-icon>
            </button>
            <button
              matIconButton
              type="button"
              class="wb-icon-button-sm"
              matTooltip="Move down"
              aria-label="Move rule down"
              [disabled]="last"
              (click)="move(rule, 1)"
            >
              <mat-icon>arrow_downward</mat-icon>
            </button>
            <button
              matIconButton
              type="button"
              class="wb-icon-button-sm"
              matTooltip="Remove"
              aria-label="Remove rule"
              (click)="remove(rule)"
            >
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
          @switch (def?.value) {
            @case ('number') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ def?.valueLabel }}</mat-label>
                <input
                  matInput
                  type="number"
                  min="0"
                  [value]="rule.value ?? ''"
                  (input)="patch(rule, { value: $any($event.target).value })"
                />
              </mat-form-field>
            }
            @case ('text') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ def?.valueLabel }}</mat-label>
                <input
                  matInput
                  [value]="rule.value ?? ''"
                  (input)="patch(rule, { value: $any($event.target).value })"
                />
                <button
                  matIconButton
                  matSuffix
                  type="button"
                  [matMenuTriggerFor]="insert"
                  [matMenuTriggerData]="{ rule }"
                  aria-label="Compare with a value"
                >
                  <mat-icon>add_circle</mat-icon>
                </button>
                @if (def?.hint) {
                  <mat-hint>{{ def?.hint }}</mat-hint>
                }
              </mat-form-field>
            }
            @case ('pattern') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ def?.valueLabel }}</mat-label>
                <input
                  matInput
                  class="wb-mono"
                  [value]="rule.value ?? ''"
                  (input)="patch(rule, { value: $any($event.target).value })"
                  spellcheck="false"
                />
                <button
                  matIconButton
                  matSuffix
                  type="button"
                  [matMenuTriggerFor]="presets"
                  [matMenuTriggerData]="{ rule }"
                  aria-label="Pattern presets"
                >
                  <mat-icon>auto_awesome</mat-icon>
                </button>
                @if (patternError(rule)) {
                  <mat-hint class="mat-text-error">{{
                    patternError(rule)
                  }}</mat-hint>
                }
              </mat-form-field>
            }
            @case ('field') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ def?.valueLabel }}</mat-label>
                <mat-select
                  [value]="rule.value"
                  (selectionChange)="patch(rule, { value: $event.value })"
                >
                  @for (name of otherFields(); track name) {
                    <mat-option [value]="name">{{ name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
          }
          @if (rule.kind === 'custom') {
            <wb-expr-editor
              [expr]="rule.expr"
              purpose="condition"
              [paths]="paths()"
              [valuePaths]="paths()"
              [scope]="previewScope()"
              [clearable]="false"
              (exprChange)="patch(rule, { expr: $event })"
            />
          }
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Error message</mat-label>
            <input
              matInput
              [value]="rule.message ?? ''"
              [placeholder]="placeholder(rule)"
              (input)="patch(rule, { message: $any($event.target).value })"
            />
          </mat-form-field>
          @if (rule.when) {
            <span class="mat-font-label-lg">Only check when</span>
            <wb-expr-editor
              [expr]="rule.when"
              purpose="condition"
              [paths]="paths()"
              [valuePaths]="paths()"
              [scope]="previewScope()"
              (exprChange)="patch(rule, { when: $event })"
            />
          } @else {
            <button
              matButton
              type="button"
              class="ui-self-start"
              (click)="patch(rule, { when: emptyCondition() })"
            >
              <mat-icon>rule</mat-icon>Only check when…
            </button>
          }
        </div>
      } @empty {
        @if (!column()) {
          <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
            No extra rules. “Required”, length and pattern in Properties still
            apply. Examples: a valid phone number, a minimum age, “matches
            Password”.
          </p>
        }
      }
      <mat-menu #presets="matMenu">
        <ng-template matMenuContent let-rule="rule">
          @for (preset of patternPresets; track preset.value) {
            <button
              mat-menu-item
              (click)="patch(rule, { value: preset.value })"
            >
              {{ preset.label }}
            </button>
          }
        </ng-template>
      </mat-menu>
      <mat-menu #insert="matMenu">
        <ng-template matMenuContent let-rule="rule">
          @for (option of paths(); track option.path) {
            <button
              mat-menu-item
              (click)="patch(rule, { value: '{{' + option.path + '}}' })"
            >
              <span class="wb-logic-chip">{{ option.group }}</span>
              {{ option.label }}
            </button>
          }
        </ng-template>
      </mat-menu>
    </section>
  `,
})
export class ValidationPanel {
  readonly block = input.required<Block>()
  /** Edit this table column's rules instead of the field's. */
  readonly column = input<TableColumn | undefined>(undefined)
  /** Extra insertable values (row fields) and preview scope for column rules. */
  readonly extraPaths = input<PathOption[]>([])
  readonly sample = input<Record<string, unknown>>({})
  readonly store = inject(BuilderStore)
  readonly runtime = inject(SiteRuntime)
  readonly definitions = VALIDATION_DEFINITIONS
  readonly patternPresets = PATTERN_PRESETS

  readonly available = computed(() =>
    this.column()
      ? VALIDATION_DEFINITIONS.filter((item) => item.kind !== 'matchField')
      : VALIDATION_DEFINITIONS,
  )
  readonly rules = computed(
    () =>
      (this.column() ? this.column()?.validations : this.block().validations) ??
      [],
  )
  readonly paths = computed<PathOption[]>(() => [
    {
      path: 'value',
      label: this.column() ? 'This cell’s new value' : 'This field’s value',
      group: 'Field',
    },
    ...this.extraPaths(),
    ...(this.column()
      ? []
      : scopePaths(
          this.store.project(),
          this.store.page(),
          (id) => Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
          this.block(),
        )),
  ])
  readonly previewScope = computed(() => {
    const column = this.column()
    if (column)
      return {
        ...this.sample(),
        value:
          (this.sample()['row'] as Record<string, unknown> | undefined)?.[
            column.field
          ] ?? '',
      }
    return {
      ...this.runtime.scope(),
      value: this.runtime.fields()[fieldName(this.block())] ?? '',
    }
  })
  readonly otherFields = computed(() => {
    const own = fieldName(this.block())
    return [
      ...new Set(
        this.store
          .layers()
          .map((layer) => layer.block)
          .filter((block) => isFormField(block.type))
          .map(fieldName),
      ),
    ].filter((name) => name !== own)
  })

  definition(rule: ValidationRule) {
    return validationDefinition(rule.kind)
  }

  placeholder(rule: ValidationRule): string {
    return defaultMessage(
      rule,
      this.column()?.header ?? String(this.block().props['label'] ?? ''),
    )
  }

  patternError(rule: ValidationRule): string {
    try {
      new RegExp(rule.value ?? '', 'u')
      return ''
    } catch {
      return 'This pattern is not a valid regular expression.'
    }
  }

  /** Applies a change to the field's rules, or to the column's when editing a column. */
  private apply(
    update: (rules: ValidationRule[]) => ValidationRule[] | false,
    key?: string,
  ): void {
    const column = this.column()
    if (!column) {
      this.store.updateValidations(update, key)
      return
    }
    this.store.updateTable(
      (table) => {
        const target = table.columns.find((item) => item.id === column.id)
        if (!target) return false
        const next = update(target.validations ?? [])
        if (next === false) return false
        if (next.length) target.validations = next.slice(0, 30)
        else delete target.validations
        return table
      },
      key ? `column:${column.id}:${key}` : undefined,
    )
  }

  emptyCondition(): Expr {
    return { kind: 'conditions', group: { combinator: 'and', conditions: [] } }
  }

  addRule(kind: ValidationKind): void {
    const rule = createValidation(kind)
    if (kind === 'matchField') rule.value = this.otherFields()[0] ?? ''
    this.apply((rules) => [...rules, rule])
  }

  patch(rule: ValidationRule, patch: Partial<ValidationRule>): void {
    this.apply((rules) => {
      const target = rules.find((item) => item.id === rule.id)
      if (!target) return false
      Object.assign(target, patch)
      return rules
    }, `validation:${rule.id}`)
  }

  remove(rule: ValidationRule): void {
    this.apply((rules) => rules.filter((item) => item.id !== rule.id))
  }

  move(rule: ValidationRule, delta: number): void {
    this.apply((rules) => {
      const index = rules.findIndex((item) => item.id === rule.id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= rules.length) return false
      ;[rules[index], rules[target]] = [rules[target], rules[index]]
      return rules
    })
  }
}
