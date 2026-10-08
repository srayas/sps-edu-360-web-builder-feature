import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import {
  ConditionGroup,
  Expr,
  evaluateExpr,
  exprToRule,
  validateExpr,
} from '../../../core/model'
import { ConditionGroupEditor } from './condition-group-editor'
import { PathOption } from './scope-paths'

export type ExprPurpose = 'condition' | 'value' | 'filter'

/**
 * Edits an expression without code: conditions for true/false questions, a text template for
 * values, or JSON Logic for advanced cases. Shows the live result for the current page state.
 */
@Component({
  selector: 'wb-expr-editor',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    ConditionGroupEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = current();
    <div class="ui-column ui-gap-2">
      <div class="ui-row ui-align-center ui-gap-2">
        <mat-button-toggle-group
          [value]="e.kind"
          (change)="switchKind($event.value)"
          hideSingleSelectionIndicator
          aria-label="Editor mode"
          class="ui-grow"
        >
          @if (purpose() !== 'value') {
            <mat-button-toggle value="conditions"
              ><mat-icon>rule</mat-icon> Conditions</mat-button-toggle
            >
          }
          @if (purpose() === 'value') {
            <mat-button-toggle value="template"
              ><mat-icon>text_fields</mat-icon> Text</mat-button-toggle
            >
            <mat-button-toggle value="conditions"
              ><mat-icon>rule</mat-icon> Yes/No</mat-button-toggle
            >
          }
          <mat-button-toggle value="rule"
            ><mat-icon>data_object</mat-icon> JSON</mat-button-toggle
          >
        </mat-button-toggle-group>
        @if (clearable()) {
          <button
            matIconButton
            type="button"
            class="wb-icon-button-sm"
            matTooltip="Remove"
            aria-label="Remove logic"
            (click)="exprChange.emit(undefined)"
          >
            <mat-icon>delete_outline</mat-icon>
          </button>
        }
      </div>

      @switch (e.kind) {
        @case ('conditions') {
          <wb-condition-group-editor
            [group]="e.group"
            [paths]="paths()"
            [valuePaths]="valuePaths()"
            [rowMode]="purpose() === 'filter'"
            (groupChange)="emitGroup($event)"
          />
        }
        @case ('template') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Value</mat-label>
            <textarea
              matInput
              rows="2"
              [value]="e.text"
              (input)="
                exprChange.emit({
                  kind: 'template',
                  text: $any($event.target).value,
                })
              "
              placeholder="Total: {{ '{{fields.qty}}' }}"
            ></textarea>
            <button
              matIconButton
              matSuffix
              type="button"
              [matMenuTriggerFor]="insert"
              aria-label="Insert a value"
            >
              <mat-icon>add_circle</mat-icon>
            </button>
            <mat-hint
              >Type text and insert values with ⊕. A single value keeps its type
              (number, list…).</mat-hint
            >
          </mat-form-field>
          <mat-menu #insert="matMenu">
            @for (option of paths(); track option.path) {
              <button
                mat-menu-item
                (click)="
                  exprChange.emit({
                    kind: 'template',
                    text: e.text + '{{' + option.path + '}}',
                  })
                "
              >
                <span class="wb-logic-chip">{{ option.group }}</span>
                {{ option.label }}
              </button>
            }
          </mat-menu>
        }
        @case ('rule') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>JSON Logic</mat-label>
            <textarea
              matInput
              rows="6"
              class="wb-mono"
              [value]="json()"
              (change)="setJson($any($event.target).value)"
              spellcheck="false"
            ></textarea>
            @if (jsonError()) {
              <mat-hint class="mat-text-error">{{ jsonError() }}</mat-hint>
            } @else {
              <mat-hint
                >e.g.
                {{
                  '{"*": [{"var": "fields.qty"}, {"var": "fields.price"}]}'
                }}</mat-hint
              >
            }
          </mat-form-field>
        }
      }

      @if (purpose() !== 'filter') {
        <div class="ui-row ui-align-center ui-gap-2">
          <span class="mat-font-label-sm mat-text-on-surface-variant">Now</span>
          <code
            class="wb-logic-result ui-grow"
            [class.mat-text-error]="!!error()"
            >{{ error() || preview() }}</code
          >
        </div>
      } @else if (error()) {
        <p class="mat-font-body-sm mat-text-error ui-m-0">{{ error() }}</p>
      }
    </div>
  `,
})
export class ExprEditor {
  readonly expr = input<Expr | undefined>(undefined)
  readonly purpose = input<ExprPurpose>('condition')
  readonly paths = input<PathOption[]>([])
  readonly valuePaths = input<PathOption[]>([])
  /** Scope used for the live preview. */
  readonly scope = input<unknown>({})
  readonly clearable = input(true)
  readonly exprChange = output<Expr | undefined>()

  readonly jsonError = signal('')
  readonly current = computed<Expr>(() => this.expr() ?? this.empty())
  readonly json = computed(() => {
    try {
      return JSON.stringify(exprToRule(this.current()), null, 2)
    } catch {
      return ''
    }
  })
  readonly error = computed(() => validateExpr(this.current()))
  readonly preview = computed(() => {
    const value = evaluateExpr(this.current(), this.scope(), null)
    if (this.purpose() === 'condition')
      return value ? 'true — applies' : 'false — does not apply'
    const text =
      typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
    return text && text.length > 140
      ? `${text.slice(0, 140)}…`
      : (text ?? 'null')
  })

  private empty(): Expr {
    return this.purpose() === 'value'
      ? { kind: 'template', text: '' }
      : { kind: 'conditions', group: { combinator: 'and', conditions: [] } }
  }

  emitGroup(group: ConditionGroup): void {
    this.exprChange.emit({ kind: 'conditions', group })
  }

  /** Switching to JSON keeps the meaning (converted rule); other switches start fresh. */
  switchKind(kind: Expr['kind']): void {
    this.jsonError.set('')
    if (kind === 'rule')
      this.exprChange.emit({ kind: 'rule', rule: exprToRule(this.current()) })
    else if (kind === 'template')
      this.exprChange.emit({ kind: 'template', text: '' })
    else
      this.exprChange.emit({
        kind: 'conditions',
        group: { combinator: 'and', conditions: [] },
      })
  }

  setJson(text: string): void {
    let rule: unknown
    try {
      rule = JSON.parse(text)
    } catch {
      this.jsonError.set('Not valid JSON yet.')
      return
    }
    const error = validateExpr({ kind: 'rule', rule })
    this.jsonError.set(error)
    if (!error) this.exprChange.emit({ kind: 'rule', rule })
  }
}
