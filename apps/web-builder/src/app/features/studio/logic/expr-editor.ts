import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
import { MatSelectModule } from '@angular/material/select'
import {
  ConditionGroup,
  Expr,
  evaluateExpr,
  exprToRule,
  functionCall,
  parseParamValue,
  validateExpr,
} from '../../../core/model'
import { BuilderStore } from '../builder-store'
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
    MatSelectModule,
    ConditionGroupEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = current();
    <div class="ui-column ui-gap-2">
      <div class="ui-row ui-align-center ui-gap-2">
        <mat-button-toggle-group
          [value]="mode()"
          (change)="switchKind($event.value)"
          hideSingleSelectionIndicator
          aria-label="Editor mode"
          class="ui-grow"
        >
          @if (purpose() !== 'value') {
            <mat-button-toggle value="conditions">Conditions</mat-button-toggle>
          }
          @if (purpose() === 'value') {
            <mat-button-toggle value="template">Text</mat-button-toggle>
            <mat-button-toggle value="conditions">Yes/No</mat-button-toggle>
          }
          @if (functions().length && purpose() !== 'filter') {
            <mat-button-toggle value="function">Function</mat-button-toggle>
          }
          <mat-button-toggle value="rule">JSON</mat-button-toggle>
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

      @if (mode() === 'function') {
        @let call = fnCall();
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Function</mat-label>
          <select
            matNativeControl
            [value]="call?.name ?? ''"
            (change)="pickFunction($any($event.target).value)"
          >
            @for (fn of functions(); track fn.id) {
              <option [value]="fn.name">
                {{ fn.name }}({{ paramList(fn.params) }})
              </option>
            }
          </select>
        </mat-form-field>
        @for (param of fnParams(); track param.name; let i = $index) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ param.name }}</mat-label>
            <input
              matInput
              [value]="argText(call?.args?.[i])"
              [placeholder]="
                param.defaultValue
                  ? 'default ' + param.defaultValue
                  : 'value or {{path}}'
              "
              (change)="setArg(i, $any($event.target).value)"
            />
            <button
              matIconButton
              matSuffix
              type="button"
              [matMenuTriggerFor]="argMenu"
              [matMenuTriggerData]="{ index: i }"
              aria-label="Insert a value"
            >
              <mat-icon>add_circle</mat-icon>
            </button>
          </mat-form-field>
        }
        <mat-menu #argMenu="matMenu">
          <ng-template matMenuContent let-index="index">
            @for (path of paths(); track path.path) {
              <button
                mat-menu-item
                (click)="setArg(index, '{{' + path.path + '}}')"
              >
                <span class="wb-logic-chip">{{ path.group }}</span>
                {{ path.label }}
              </button>
            }
          </ng-template>
        </mat-menu>
      } @else {
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
                >Type text and insert values with ⊕. A single value keeps its
                type (number, list…).</mat-hint
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

  private readonly store = inject(BuilderStore, { optional: true })
  readonly functions = computed(() => this.store?.project().functions ?? [])
  /** The editing mode: the stored kind, or "function" for a {"fn": …} rule. */
  readonly mode = computed(() => {
    const expr = this.current()
    return expr.kind === 'rule' &&
      functionCall(expr.rule) &&
      this.functions().length
      ? 'function'
      : expr.kind
  })
  readonly fnCall = computed(() => {
    const expr = this.current()
    return expr.kind === 'rule' ? functionCall(expr.rule) : null
  })
  readonly fnParams = computed(
    () =>
      this.functions().find((fn) => fn.name === this.fnCall()?.name)?.params ??
      [],
  )

  paramList(params: { name: string }[]): string {
    return params.map((param) => param.name).join(', ')
  }

  /** `{"var": "a.b"}` shows as {{a.b}}; literals as text / JSON. */
  argText(arg: unknown): string {
    if (
      arg &&
      typeof arg === 'object' &&
      !Array.isArray(arg) &&
      Object.keys(arg).length === 1 &&
      'var' in arg
    )
      return `{{${(arg as { var: unknown }).var}}}`
    if (arg === undefined || arg === null) return ''
    return typeof arg === 'string' ? arg : JSON.stringify(arg)
  }

  pickFunction(name: string): void {
    const fn = this.functions().find((item) => item.name === name)
    this.exprChange.emit({
      kind: 'rule',
      rule: { fn: [name, ...(fn?.params ?? []).map(() => null)] },
    })
  }

  setArg(index: number, text: string): void {
    const call = this.fnCall()
    if (!call) return
    const args = [...call.args]
    while (args.length < this.fnParams().length) args.push(null)
    const path = /^\s*\{\{\s*([\w.-]+)\s*\}\}\s*$/.exec(text)
    const value = path ? { var: path[1] } : parseParamValue(text)
    args[index] =
      value !== null && typeof value === 'object' && !path
        ? { preserve: value }
        : value
    this.exprChange.emit({ kind: 'rule', rule: { fn: [call.name, ...args] } })
  }

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
  switchKind(kind: Expr['kind'] | 'function'): void {
    this.jsonError.set('')
    if (kind === 'function') {
      this.pickFunction(this.functions()[0]?.name ?? '')
      return
    }
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
