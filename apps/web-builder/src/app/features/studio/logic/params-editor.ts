import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { ExecutionParam, FUNCTION_NAME } from '../../../core/model'

/** Inputs of a function or workflow: name and optional default. */
@Component({
  selector: 'wb-params-editor',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column ui-gap-2">
      @for (param of params(); track $index; let i = $index) {
        <div class="ui-row ui-gap-2 ui-align-start">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="ui-grow wb-shrink"
          >
            <mat-label>Input name</mat-label>
            <input
              matInput
              class="wb-mono"
              [value]="param.name"
              (change)="edit(i, { name: $any($event.target).value.trim() })"
            />
            @if (!valid(param.name)) {
              <mat-hint class="mat-text-error"
                >Letters, digits and _ ; start with a letter</mat-hint
              >
            }
          </mat-form-field>
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="ui-grow wb-shrink"
          >
            <mat-label>Default</mat-label>
            <input
              matInput
              [value]="param.defaultValue ?? ''"
              (change)="
                edit(i, {
                  defaultValue: $any($event.target).value || undefined,
                })
              "
            />
          </mat-form-field>
          <button
            matIconButton
            type="button"
            class="wb-icon-button-sm"
            aria-label="Remove input"
            (click)="remove(i)"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      <button matButton type="button" class="ui-self-start" (click)="add()">
        <mat-icon>add</mat-icon>Input
      </button>
    </div>
  `,
})
export class ParamsEditor {
  readonly params = input.required<ExecutionParam[]>()
  readonly paramsChange = output<ExecutionParam[]>()

  valid(name: string): boolean {
    return FUNCTION_NAME.test(name)
  }

  edit(index: number, patch: Partial<ExecutionParam>): void {
    const next = this.params().map((param, position) =>
      position === index ? { ...param, ...patch } : param,
    )
    if (patch.defaultValue === undefined) delete next[index].defaultValue
    if (
      next.every((param) => this.valid(param.name)) &&
      new Set(next.map((param) => param.name)).size === next.length
    )
      this.paramsChange.emit(next)
  }

  add(): void {
    const names = new Set(this.params().map((param) => param.name))
    let name = 'value'
    for (let n = 2; names.has(name); n++) name = `value${n}`
    this.paramsChange.emit([...this.params(), { name }])
  }

  remove(index: number): void {
    this.paramsChange.emit(
      this.params().filter((_, position) => position !== index),
    )
  }
}
