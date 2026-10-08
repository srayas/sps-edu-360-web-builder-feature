import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatAutocompleteModule } from '@angular/material/autocomplete'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { CONDITION_OPERATORS } from '@spsedu360/json-logic'
import { Condition, ConditionGroup } from '../../../core/model'
import { PathOption } from './scope-paths'

const isGroup = (item: Condition | ConditionGroup): item is ConditionGroup =>
  'combinator' in item

/**
 * Visual editor for an All/Any group of conditions (one level of nested groups). Every change
 * emits a new group; nothing is mutated in place.
 */
@Component({
  selector: 'wb-condition-group-editor',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatIconModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = group();
    <div class="ui-column ui-gap-2" [class.wb-condition-group]="nested()">
      <div class="ui-row ui-align-center ui-gap-2">
        <span class="mat-font-label-md mat-text-on-surface-variant">Match</span>
        <mat-button-toggle-group
          [value]="g.combinator"
          (change)="
            emit({ combinator: $event.value, conditions: g.conditions })
          "
          hideSingleSelectionIndicator
          aria-label="Combine conditions"
        >
          <mat-button-toggle value="and">All</mat-button-toggle>
          <mat-button-toggle value="or">Any</mat-button-toggle>
        </mat-button-toggle-group>
        <span class="ui-spacer"></span>
        @if (nested()) {
          <button
            matIconButton
            type="button"
            class="wb-icon-button-sm"
            matTooltip="Remove group"
            aria-label="Remove group"
            (click)="remove.emit()"
          >
            <mat-icon>close</mat-icon>
          </button>
        }
      </div>
      @for (item of g.conditions; track $index; let index = $index) {
        @if (isGroup(item)) {
          <wb-condition-group-editor
            [group]="item"
            [nested]="true"
            [paths]="paths()"
            [valuePaths]="valuePaths()"
            [rowMode]="rowMode()"
            (groupChange)="replace(index, $event)"
            (remove)="removeAt(index)"
          />
        } @else {
          <div class="wb-condition ui-column ui-gap-2">
            <div class="ui-row ui-gap-2 ui-align-start">
              <mat-form-field
                appearance="outline"
                subscriptSizing="dynamic"
                class="ui-grow"
              >
                <mat-label>{{
                  rowMode() ? 'Row field' : 'Value of'
                }}</mat-label>
                <input
                  matInput
                  [value]="item.field"
                  [matAutocomplete]="fieldAuto"
                  (input)="patch(index, { field: $any($event.target).value })"
                  placeholder="fields.country"
                />
                @if (labelOf(item.field); as friendly) {
                  <mat-hint>{{ friendly }}</mat-hint>
                }
                <mat-autocomplete
                  #fieldAuto="matAutocomplete"
                  (optionSelected)="
                    patch(index, { field: $event.option.value })
                  "
                >
                  @for (
                    option of filtered(item.field, paths());
                    track option.path
                  ) {
                    <mat-option [value]="option.path"
                      ><span class="wb-logic-chip">{{ option.group }}</span>
                      {{ option.label }}</mat-option
                    >
                  }
                </mat-autocomplete>
              </mat-form-field>
              <button
                matIconButton
                type="button"
                class="wb-icon-button-sm"
                matTooltip="Remove condition"
                aria-label="Remove condition"
                (click)="removeAt(index)"
              >
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Condition</mat-label>
              <mat-select
                [value]="item.operator"
                (selectionChange)="patch(index, { operator: $event.value })"
              >
                @for (operator of operators; track operator.value) {
                  <mat-option [value]="operator.value">{{
                    operator.label
                  }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (arity(item) > 0) {
              <div class="ui-row ui-gap-2 ui-align-start">
                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="ui-grow"
                >
                  <mat-label>{{
                    item.source === 'literal' || !item.source
                      ? 'Value'
                      : rowMode()
                        ? 'Page value'
                        : 'Other value'
                  }}</mat-label>
                  <input
                    matInput
                    [value]="item.value ?? ''"
                    [matAutocomplete]="valueAuto"
                    [placeholder]="
                      item.operator === 'in' || item.operator === 'not_in'
                        ? 'a, b, c'
                        : ''
                    "
                    (input)="patch(index, { value: $any($event.target).value })"
                  />
                  <mat-autocomplete
                    #valueAuto="matAutocomplete"
                    (optionSelected)="
                      patch(index, { value: $event.option.value })
                    "
                  >
                    @if (item.source && item.source !== 'literal') {
                      @for (
                        option of filtered(stringOf(item.value), valuePaths());
                        track option.path
                      ) {
                        <mat-option [value]="option.path">{{
                          option.label
                        }}</mat-option>
                      }
                    }
                  </mat-autocomplete>
                </mat-form-field>
                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="wb-source-select"
                >
                  <mat-select
                    [value]="item.source ?? 'literal'"
                    (selectionChange)="patch(index, { source: $event.value })"
                    aria-label="Compare with"
                  >
                    <mat-option value="literal">Typed</mat-option>
                    <mat-option [value]="rowMode() ? 'param' : 'field'">{{
                      rowMode() ? 'Page value' : 'Another value'
                    }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              @if (arity(item) === 2) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>and</mat-label>
                  <input
                    matInput
                    [value]="item.value2 ?? ''"
                    (input)="
                      patch(index, { value2: $any($event.target).value })
                    "
                  />
                </mat-form-field>
              }
            }
          </div>
        }
      } @empty {
        <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
          No conditions yet — always true.
        </p>
      }
      <div class="ui-row ui-gap-1">
        <button matButton type="button" (click)="add()">
          <mat-icon>add</mat-icon>Condition
        </button>
        @if (!nested()) {
          <button matButton type="button" (click)="addGroup()">
            <mat-icon>account_tree</mat-icon>Group
          </button>
        }
      </div>
    </div>
  `,
})
export class ConditionGroupEditor {
  readonly group = input.required<ConditionGroup>()
  readonly nested = input(false)
  /** Paths the left side can read (scope paths, or row fields in row mode). */
  readonly paths = input<PathOption[]>([])
  /** Paths offered when comparing with another value. */
  readonly valuePaths = input<PathOption[]>([])
  /** Row mode: conditions test data rows; "Page value" compares with page scope values. */
  readonly rowMode = input(false)
  readonly groupChange = output<ConditionGroup>()
  readonly remove = output<void>()

  readonly operators = CONDITION_OPERATORS
  readonly isGroup = isGroup
  readonly arityOf = computed(
    () =>
      new Map(
        CONDITION_OPERATORS.map((operator) => [operator.value, operator.arity]),
      ),
  )

  arity(condition: Condition): number {
    return this.arityOf().get(condition.operator) ?? 1
  }

  stringOf(value: unknown): string {
    return value === null || value === undefined ? '' : String(value)
  }

  /** Friendly name of a path, e.g. "Fields · Country". */
  labelOf(path: string): string {
    const option = this.paths().find((item) => item.path === path)
    return option ? `${option.group} · ${option.label}` : ''
  }

  filtered(term: string, options: PathOption[]): PathOption[] {
    const needle = (term ?? '').toLowerCase()
    return options
      .filter(
        (option) =>
          !needle ||
          option.path.toLowerCase().includes(needle) ||
          option.label.toLowerCase().includes(needle),
      )
      .slice(0, 40)
  }

  emit(group: ConditionGroup): void {
    this.groupChange.emit(group)
  }

  patch(index: number, patch: Partial<Condition>): void {
    const conditions = [...this.group().conditions]
    const current = conditions[index] as Condition
    const next = { ...current, ...patch }
    if (patch.source) next.value = ''
    conditions[index] = next
    this.emit({ ...this.group(), conditions })
  }

  replace(index: number, group: ConditionGroup): void {
    const conditions = [...this.group().conditions]
    conditions[index] = group
    this.emit({ ...this.group(), conditions })
  }

  removeAt(index: number): void {
    this.emit({
      ...this.group(),
      conditions: this.group().conditions.filter(
        (_, position) => position !== index,
      ),
    })
  }

  add(): void {
    const first = this.paths()[0]?.path ?? ''
    this.emit({
      ...this.group(),
      conditions: [
        ...this.group().conditions,
        { field: first, operator: 'eq', value: '', source: 'literal' },
      ],
    })
  }

  addGroup(): void {
    this.emit({
      ...this.group(),
      conditions: [
        ...this.group().conditions,
        { combinator: 'or', conditions: [] },
      ],
    })
  }
}
