import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatTooltipModule } from '@angular/material/tooltip'
import { EmptyState } from '@spsedu360/shared-ui'
import {
  FUNCTION_NAME,
  LogicFunction,
  callFunction,
  parseParamValue,
  setFunctions,
  validateExpr,
} from '../../../core/model'
import { BuilderStore } from '../builder-store'
import { ExprEditor } from './expr-editor'
import { ParamsEditor } from './params-editor'
import { PathOption } from './scope-paths'

/** Reusable calculations: named JSON Logic with inputs, callable from any expression. */
@Component({
  selector: 'wb-functions-panel',
  imports: [
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    EmptyState,
    ExprEditor,
    ParamsEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column ui-gap-3">
      <div class="ui-column ui-gap-2">
        <span class="mat-font-body-sm mat-text-on-surface-variant"
          >Reusable calculations. Call them anywhere with the
          <strong>Function</strong> mode of a value editor, or
          <code>{{ '{"fn": ["name", …]}' }}</code
          >.</span
        >
        <button
          matButton="tonal"
          type="button"
          class="ui-self-start"
          (click)="store.addFunction()"
        >
          <mat-icon>add</mat-icon>Function
        </button>
      </div>
      <mat-accordion displayMode="flat" multi>
        @for (fn of functions(); track fn.id; let last = $last) {
          <mat-expansion-panel [expanded]="last">
            <mat-expansion-panel-header>
              <mat-panel-title class="ui-gap-2"
                ><mat-icon class="ui-icon-sm">function</mat-icon
                ><code>{{ fn.name }}({{ names(fn) }})</code></mat-panel-title
              >
            </mat-expansion-panel-header>
            <div class="ui-column ui-gap-3">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Name</mat-label>
                <input
                  matInput
                  class="wb-mono"
                  [value]="fn.name"
                  (change)="rename(fn, $any($event.target).value)"
                />
                @if (errors()[fn.id]) {
                  <mat-hint class="mat-text-error">{{
                    errors()[fn.id]
                  }}</mat-hint>
                }
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Description</mat-label>
                <input
                  matInput
                  [value]="fn.description ?? ''"
                  (input)="
                    store.updateFunction(fn.id, {
                      description: $any($event.target).value || undefined,
                    })
                  "
                />
              </mat-form-field>
              <span class="mat-font-label-lg">Inputs</span>
              <wb-params-editor
                [params]="fn.params"
                (paramsChange)="store.updateFunction(fn.id, { params: $event })"
              />
              <span class="mat-font-label-lg">Returns</span>
              <wb-expr-editor
                [expr]="fn.body"
                purpose="value"
                [paths]="paramPaths(fn)"
                [valuePaths]="paramPaths(fn)"
                [scope]="testScope(fn)"
                [clearable]="false"
                (exprChange)="setBody(fn, $event)"
              />
              <span class="mat-font-label-lg">Try it</span>
              <div class="wb-option-grid">
                @for (param of fn.params; track param.name) {
                  <mat-form-field
                    appearance="outline"
                    subscriptSizing="dynamic"
                  >
                    <mat-label>{{ param.name }}</mat-label>
                    <input
                      matInput
                      [value]="
                        tests()[fn.id + ':' + param.name] ??
                        param.defaultValue ??
                        ''
                      "
                      (input)="
                        setTest(fn, param.name, $any($event.target).value)
                      "
                    />
                  </mat-form-field>
                }
              </div>
              <div class="ui-row ui-align-center ui-gap-2">
                <span class="mat-font-label-sm mat-text-on-surface-variant"
                  >Result</span
                >
                <code class="wb-logic-result ui-grow">{{ result(fn) }}</code>
              </div>
              <button
                matButton
                type="button"
                class="ui-self-end"
                (click)="store.removeFunction(fn.id)"
              >
                <mat-icon>delete_outline</mat-icon>Delete function
              </button>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>
      @if (!functions().length) {
        <ui-empty-state
          icon="function"
          heading="No functions yet"
          message="Example: lineTotal(qty, price, discount) used by a total field, a table column and a page rule."
        />
      }
    </div>
  `,
})
export class FunctionsPanel {
  readonly store = inject(BuilderStore)
  readonly functions = computed(() => this.store.project().functions ?? [])
  readonly errors = signal<Record<string, string>>({})
  readonly tests = signal<Partial<Record<string, string>>>({})

  names(fn: LogicFunction): string {
    return fn.params.map((param) => param.name).join(', ')
  }

  paramPaths(fn: LogicFunction): PathOption[] {
    return fn.params.map((param) => ({
      path: param.name,
      label: param.name,
      group: 'Input' as const,
    }))
  }

  testArgs(fn: LogicFunction): unknown[] {
    const tests = this.tests()
    return fn.params.map((param) =>
      parseParamValue(tests[`${fn.id}:${param.name}`] ?? param.defaultValue),
    )
  }

  testScope(fn: LogicFunction): Record<string, unknown> {
    const args = this.testArgs(fn)
    return Object.fromEntries(
      fn.params.map((param, index) => [param.name, args[index]]),
    )
  }

  result(fn: LogicFunction): string {
    setFunctions(this.functions())
    try {
      const value = callFunction(fn.name, this.testArgs(fn))
      const text =
        typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
      return text ?? 'null'
    } catch (error) {
      return error instanceof Error ? error.message : 'Error'
    }
  }

  setTest(fn: LogicFunction, name: string, value: string): void {
    this.tests.update((tests) => ({ ...tests, [`${fn.id}:${name}`]: value }))
  }

  rename(fn: LogicFunction, name: string): void {
    const clean = name.trim()
    const error = !FUNCTION_NAME.test(clean)
      ? 'Use letters, digits and _ (start with a letter).'
      : this.functions().some(
            (other) => other.id !== fn.id && other.name === clean,
          )
        ? 'Another function has this name.'
        : ''
    this.errors.update((errors) => ({ ...errors, [fn.id]: error }))
    if (!error) this.store.updateFunction(fn.id, { name: clean })
  }

  setBody(fn: LogicFunction, body: LogicFunction['body'] | undefined): void {
    if (body && !validateExpr(body)) this.store.updateFunction(fn.id, { body })
  }
}
