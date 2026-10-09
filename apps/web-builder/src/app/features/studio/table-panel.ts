import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core'
import { NgTemplateOutlet } from '@angular/common'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatMenuModule } from '@angular/material/menu'
import { MatSelectModule } from '@angular/material/select'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatAutocompleteModule } from '@angular/material/autocomplete'
import {
  ACTION_DEFINITIONS,
  Block,
  CELL_KINDS,
  isEditableCell,
  COLUMN_FORMATS,
  Expr,
  RowActionPreset,
  TONES,
  TableColumn,
  TableConfig,
  ToneRule,
  createColumn,
  createHeaderGroup,
  createMerge,
  createRowAction,
  createToneRule,
  emptyTable,
  lines,
} from '../../core/model'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { ActionEditor } from './action-editor'
import { BuilderStore } from './builder-store'
import { ExprEditor } from './logic/expr-editor'
import { PathOption, scopePaths } from './logic/scope-paths'
import { ValidationPanel } from './logic/validation-panel'

/** Data table configuration: columns, row actions, header groups, merges and highlights. */
@Component({
  selector: 'wb-table-panel',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatAutocompleteModule,
    NgTemplateOutlet,
    ExprEditor,
    ActionEditor,
    ValidationPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = table();
    <section class="ui-column ui-gap-3">
      <h3 class="mat-font-title-sm ui-m-0">Table</h3>
      <mat-accordion multi displayMode="flat">
        <!-- Columns -->
        <mat-expansion-panel [expanded]="true">
          <mat-expansion-panel-header>
            <mat-panel-title class="ui-gap-2"
              ><mat-icon class="ui-icon-sm">view_column</mat-icon
              >Columns</mat-panel-title
            >
            <mat-panel-description>{{
              t.columns.length ? t.columns.length : 'auto'
            }}</mat-panel-description>
          </mat-expansion-panel-header>
          @if (!t.columns.length) {
            <p class="mat-font-body-sm mat-text-on-surface-variant ui-mt-0">
              Every field of the data is shown as text. Customize to choose
              columns, formats, computed values and highlights.
            </p>
            <button matButton="tonal" type="button" (click)="customize()">
              <mat-icon>tune</mat-icon>Customize columns
            </button>
          } @else {
            <div class="ui-column ui-gap-2">
              @for (
                column of t.columns;
                track column.id;
                let first = $first;
                let last = $last
              ) {
                <mat-expansion-panel class="wb-advanced">
                  <mat-expansion-panel-header>
                    <mat-panel-title class="ui-gap-2"
                      ><mat-icon class="ui-icon-sm">{{
                        formatIcon(column)
                      }}</mat-icon
                      >{{
                        column.header || column.field || 'Column'
                      }}</mat-panel-title
                    >
                    <mat-panel-description>{{
                      column.cell && column.cell !== 'display'
                        ? cellLabel(column)
                        : column.value
                          ? 'computed'
                          : column.field
                    }}</mat-panel-description>
                  </mat-expansion-panel-header>
                  <div class="ui-column ui-gap-2">
                    <div class="wb-option-grid">
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                      >
                        <mat-label>Header</mat-label>
                        <input
                          matInput
                          [value]="column.header"
                          (input)="
                            patchColumn(column, {
                              header: $any($event.target).value,
                            })
                          "
                        />
                      </mat-form-field>
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                      >
                        <mat-label>Field</mat-label>
                        <input
                          matInput
                          [value]="column.field"
                          [matAutocomplete]="fieldAuto"
                          (input)="
                            patchColumn(column, {
                              field: $any($event.target).value,
                            })
                          "
                        />
                        <mat-autocomplete
                          #fieldAuto="matAutocomplete"
                          (optionSelected)="
                            patchColumn(column, { field: $event.option.value })
                          "
                        >
                          @for (key of rowKeys(); track key) {
                            <mat-option [value]="key">{{ key }}</mat-option>
                          }
                        </mat-autocomplete>
                      </mat-form-field>
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                      >
                        <mat-label>Format</mat-label>
                        <mat-select
                          [value]="column.format"
                          (selectionChange)="
                            patchColumn(column, { format: $event.value })
                          "
                        >
                          @for (format of formats; track format.value) {
                            <mat-option [value]="format.value"
                              ><mat-icon>{{ format.icon }}</mat-icon
                              >{{ format.label }}</mat-option
                            >
                          }
                        </mat-select>
                      </mat-form-field>
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                      >
                        <mat-label>Width</mat-label>
                        <mat-select
                          [value]="column.width ?? ''"
                          (selectionChange)="
                            patchColumn(column, {
                              width: $event.value || undefined,
                            })
                          "
                        >
                          @for (width of widths; track width.value) {
                            <mat-option [value]="width.value">{{
                              width.label
                            }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>
                    <span class="mat-font-label-lg">Cell</span>
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                    >
                      <mat-label>Cell type</mat-label>
                      <mat-select
                        [value]="column.cell || 'display'"
                        (selectionChange)="
                          store.setColumnCell(column.id, $event.value)
                        "
                      >
                        @for (kind of cellKinds; track kind.value) {
                          <mat-option [value]="kind.value"
                            ><mat-icon>{{ kind.icon }}</mat-icon
                            >{{ kind.label }}</mat-option
                          >
                        }
                      </mat-select>
                      <mat-hint>{{ cellHint(column) }}</mat-hint>
                    </mat-form-field>
                    @if (column.cell && column.cell !== 'display') {
                      @if (column.cellWhen) {
                        <span class="mat-font-label-lg"
                          >Use it for rows where</span
                        >
                        <wb-expr-editor
                          [expr]="column.cellWhen"
                          purpose="condition"
                          [paths]="rowPaths()"
                          [valuePaths]="rowPaths()"
                          [scope]="sampleScope()"
                          (exprChange)="
                            patchColumn(column, { cellWhen: $event })
                          "
                        />
                        <span
                          class="mat-font-body-sm mat-text-on-surface-variant"
                          >Other rows show the formatted value.</span
                        >
                      } @else {
                        <button
                          matButton
                          type="button"
                          class="ui-self-start"
                          (click)="
                            patchColumn(column, { cellWhen: emptyCondition() })
                          "
                        >
                          <mat-icon>rule</mat-icon>Only for some rows…
                        </button>
                      }
                    }
                    @if (column.cell === 'blocks') {
                      <div class="wb-action ui-column ui-gap-2 ui-p-3">
                        <p
                          class="mat-font-body-sm mat-text-on-surface-variant ui-m-0"
                        >
                          Drag any blocks into this column's cell in the
                          <strong>first row</strong> on the canvas — they repeat
                          on every row. Inside, use
                          <code>{{ '{{row.…}}' }}</code> for the row's values;
                          buttons can run steps with the row.
                        </p>
                        <button
                          matButton="tonal"
                          type="button"
                          class="ui-self-start"
                          (click)="store.selectCell(column.id)"
                        >
                          <mat-icon>dashboard_customize</mat-icon>Design cell
                        </button>
                      </div>
                    } @else if (editable(column)) {
                      <div class="wb-action ui-column ui-gap-2 ui-p-3">
                        @if (column.cell === 'select') {
                          <mat-button-toggle-group
                            [value]="column.optionsExpr ? 'expr' : 'list'"
                            (change)="optionsMode(column, $event.value)"
                            hideSingleSelectionIndicator
                            aria-label="Options come from"
                            class="ui-fill"
                          >
                            <mat-button-toggle value="list"
                              >Typed options</mat-button-toggle
                            ><mat-button-toggle value="expr"
                              >From data</mat-button-toggle
                            >
                          </mat-button-toggle-group>
                          @if (column.optionsExpr) {
                            <wb-expr-editor
                              [expr]="column.optionsExpr"
                              purpose="value"
                              [paths]="rowPaths()"
                              [valuePaths]="rowPaths()"
                              [scope]="sampleScope()"
                              [clearable]="false"
                              (exprChange)="
                                patchColumn(column, { optionsExpr: $event })
                              "
                            />
                            <span
                              class="mat-font-body-sm mat-text-on-surface-variant"
                              >A list — a data source, a variable, or a value of
                              the row. Items can be text or objects with label
                              and value.</span
                            >
                          } @else {
                            <mat-form-field
                              appearance="outline"
                              subscriptSizing="dynamic"
                            >
                              <mat-label>Options</mat-label>
                              <textarea
                                matInput
                                rows="3"
                                [value]="column.options ?? ''"
                                placeholder="Pending&#10;Shipped|shipped"
                                (input)="
                                  patchColumn(column, {
                                    options: $any($event.target).value,
                                  })
                                "
                              ></textarea>
                              <mat-hint
                                >One per line: Label or Label|value</mat-hint
                              >
                            </mat-form-field>
                          }
                        }
                        @if (
                          column.cell === 'input' ||
                          column.cell === 'number' ||
                          column.cell === 'select'
                        ) {
                          <mat-form-field
                            appearance="outline"
                            subscriptSizing="dynamic"
                          >
                            <mat-label>Placeholder</mat-label>
                            <input
                              matInput
                              [value]="column.placeholder ?? ''"
                              (input)="
                                patchColumn(column, {
                                  placeholder:
                                    $any($event.target).value || undefined,
                                })
                              "
                            />
                          </mat-form-field>
                        }
                        <mat-slide-toggle
                          [checked]="!!column.autoSave"
                          [disabled]="!sourceId()"
                          (change)="
                            patchColumn(column, {
                              autoSave: $event.checked || undefined,
                            })
                          "
                          >Save changes to the record
                          automatically</mat-slide-toggle
                        >
                        @if (!sourceId()) {
                          <span
                            class="mat-font-body-sm mat-text-on-surface-variant"
                            >Connect a data source to save edits; typed rows
                            keep edits on the page.</span
                          >
                        }
                        <wb-validation-panel
                          [block]="block()"
                          [column]="column"
                          [extraPaths]="rowPaths()"
                          [sample]="sampleScope()"
                        />
                        <div class="ui-row ui-align-center">
                          <div class="ui-column ui-grow">
                            <span class="mat-font-label-lg">On change</span>
                            <span
                              class="mat-font-body-sm mat-text-on-surface-variant"
                              >Runs after a valid change with
                              <code>{{ '{{row}}' }}</code> and
                              <code>{{ '{{value}}' }}</code>.</span
                            >
                          </div>
                          <button
                            matButton
                            type="button"
                            [matMenuTriggerFor]="changeMenu"
                            [matMenuTriggerData]="{ id: column.id }"
                          >
                            <mat-icon>add</mat-icon>Step
                          </button>
                        </div>
                        @for (
                          step of column.onChange ?? [];
                          track step.id;
                          let i = $index;
                          let lastStep = $last
                        ) {
                          <wb-action-editor
                            [action]="step"
                            [index]="i"
                            [last]="lastStep"
                            [depth]="1"
                          />
                        }
                      </div>
                    }
                    <span class="mat-font-label-lg">Display</span>
                    @switch (column.format) {
                      @case ('currency') {
                        <div class="wb-option-grid">
                          <mat-form-field
                            appearance="outline"
                            subscriptSizing="dynamic"
                            ><mat-label>Currency</mat-label
                            ><input
                              matInput
                              [value]="column.formatOptions?.['currency'] ?? ''"
                              placeholder="USD"
                              (input)="
                                formatOption(
                                  column,
                                  'currency',
                                  $any($event.target).value
                                )
                              "
                          /></mat-form-field>
                          <mat-form-field
                            appearance="outline"
                            subscriptSizing="dynamic"
                            ><mat-label>Decimals</mat-label
                            ><input
                              matInput
                              type="number"
                              min="0"
                              max="6"
                              [value]="column.formatOptions?.['decimals'] ?? ''"
                              (input)="
                                formatOption(
                                  column,
                                  'decimals',
                                  $any($event.target).value
                                )
                              "
                          /></mat-form-field>
                        </div>
                      }
                      @case ('number') {
                        <mat-form-field
                          appearance="outline"
                          subscriptSizing="dynamic"
                          ><mat-label>Decimals</mat-label
                          ><input
                            matInput
                            type="number"
                            min="0"
                            max="6"
                            [value]="column.formatOptions?.['decimals'] ?? ''"
                            (input)="
                              formatOption(
                                column,
                                'decimals',
                                $any($event.target).value
                              )
                            "
                        /></mat-form-field>
                      }
                      @case ('percent') {
                        <mat-slide-toggle
                          [checked]="column.formatOptions?.['scale'] === '100'"
                          (change)="
                            formatOption(
                              column,
                              'scale',
                              $event.checked ? '100' : ''
                            )
                          "
                          >Values are 0–100 (not 0–1)</mat-slide-toggle
                        >
                      }
                      @case ('progress') {
                        <mat-slide-toggle
                          [checked]="column.formatOptions?.['scale'] === '1'"
                          (change)="
                            formatOption(
                              column,
                              'scale',
                              $event.checked ? '1' : ''
                            )
                          "
                          >Values are 0–1 (not 0–100)</mat-slide-toggle
                        >
                      }
                      @case ('date') {
                        <mat-form-field
                          appearance="outline"
                          subscriptSizing="dynamic"
                        >
                          <mat-label>Date style</mat-label>
                          <mat-select
                            [value]="
                              column.formatOptions?.['style'] || 'medium'
                            "
                            (selectionChange)="
                              formatOption(column, 'style', $event.value)
                            "
                          >
                            <mat-option value="short">Short</mat-option
                            ><mat-option value="medium">Medium</mat-option
                            ><mat-option value="long">Long</mat-option>
                          </mat-select>
                        </mat-form-field>
                      }
                      @case ('boolean') {
                        <div class="wb-option-grid">
                          <mat-form-field
                            appearance="outline"
                            subscriptSizing="dynamic"
                            ><mat-label>Yes text</mat-label
                            ><input
                              matInput
                              [value]="column.formatOptions?.['yes'] ?? ''"
                              placeholder="Yes"
                              (input)="
                                formatOption(
                                  column,
                                  'yes',
                                  $any($event.target).value
                                )
                              "
                          /></mat-form-field>
                          <mat-form-field
                            appearance="outline"
                            subscriptSizing="dynamic"
                            ><mat-label>No text</mat-label
                            ><input
                              matInput
                              [value]="column.formatOptions?.['no'] ?? ''"
                              placeholder="No"
                              (input)="
                                formatOption(
                                  column,
                                  'no',
                                  $any($event.target).value
                                )
                              "
                          /></mat-form-field>
                        </div>
                      }
                      @case ('link') {
                        <mat-form-field
                          appearance="outline"
                          subscriptSizing="dynamic"
                          ><mat-label>Link text (optional)</mat-label
                          ><input
                            matInput
                            [value]="column.formatOptions?.['label'] ?? ''"
                            placeholder="Open"
                            (input)="
                              formatOption(
                                column,
                                'label',
                                $any($event.target).value
                              )
                            "
                        /></mat-form-field>
                      }
                    }
                    <div class="ui-row ui-align-center ui-gap-3 ui-wrap">
                      <mat-button-toggle-group
                        [value]="column.align"
                        (change)="patchColumn(column, { align: $event.value })"
                        hideSingleSelectionIndicator
                        aria-label="Alignment"
                      >
                        <mat-button-toggle
                          value="start"
                          aria-label="Align start"
                          ><mat-icon
                            >format_align_left</mat-icon
                          ></mat-button-toggle
                        >
                        <mat-button-toggle
                          value="center"
                          aria-label="Align center"
                          ><mat-icon
                            >format_align_center</mat-icon
                          ></mat-button-toggle
                        >
                        <mat-button-toggle value="end" aria-label="Align end"
                          ><mat-icon
                            >format_align_right</mat-icon
                          ></mat-button-toggle
                        >
                      </mat-button-toggle-group>
                      <mat-slide-toggle
                        [checked]="column.sortable"
                        (change)="
                          patchColumn(column, { sortable: $event.checked })
                        "
                        >Sortable</mat-slide-toggle
                      >
                    </div>
                    <mat-slide-toggle
                      [checked]="!!column.mergeEqual"
                      (change)="
                        patchColumn(column, {
                          mergeEqual: $event.checked || undefined,
                        })
                      "
                      >Merge rows with the same value</mat-slide-toggle
                    >

                    <span class="mat-font-label-lg">Value</span>
                    @if (column.value) {
                      <wb-expr-editor
                        [expr]="column.value"
                        purpose="value"
                        [paths]="rowPaths()"
                        [valuePaths]="rowPaths()"
                        [scope]="sampleScope()"
                        (exprChange)="patchColumn(column, { value: $event })"
                      />
                    } @else {
                      <button
                        matButton
                        type="button"
                        class="ui-self-start"
                        (click)="
                          patchColumn(column, {
                            value: {
                              kind: 'template',
                              text: '{{row.' + (column.field || 'name') + '}}',
                            },
                          })
                        "
                      >
                        <mat-icon>calculate</mat-icon>Compute from other values…
                      </button>
                    }

                    <span class="mat-font-label-lg">Highlight cell</span>
                    <ng-container
                      *ngTemplateOutlet="
                        tones;
                        context: {
                          rules: column.tones ?? [],
                          set: tonesSetter(column),
                        }
                      "
                    />

                    <span class="mat-font-label-lg">Show column</span>
                    @if (column.visible) {
                      <wb-expr-editor
                        [expr]="column.visible"
                        purpose="condition"
                        [paths]="pagePaths()"
                        [valuePaths]="pagePaths()"
                        [scope]="runtime.scope()"
                        (exprChange)="patchColumn(column, { visible: $event })"
                      />
                    } @else {
                      <button
                        matButton
                        type="button"
                        class="ui-self-start"
                        (click)="
                          patchColumn(column, { visible: emptyCondition() })
                        "
                      >
                        <mat-icon>visibility</mat-icon>Only when…
                      </button>
                    }

                    <div class="ui-row ui-gap-1">
                      <button
                        matIconButton
                        type="button"
                        matTooltip="Move left"
                        aria-label="Move column left"
                        [disabled]="first"
                        (click)="moveColumn(column, -1)"
                      >
                        <mat-icon>arrow_back</mat-icon>
                      </button>
                      <button
                        matIconButton
                        type="button"
                        matTooltip="Move right"
                        aria-label="Move column right"
                        [disabled]="last"
                        (click)="moveColumn(column, 1)"
                      >
                        <mat-icon>arrow_forward</mat-icon>
                      </button>
                      <span class="ui-spacer"></span>
                      <button
                        matButton
                        type="button"
                        (click)="removeColumn(column)"
                      >
                        <mat-icon>delete_outline</mat-icon>Remove
                      </button>
                    </div>
                  </div>
                </mat-expansion-panel>
              }
              <div class="ui-row ui-gap-2 ui-wrap">
                <button
                  matButton="tonal"
                  type="button"
                  [matMenuTriggerFor]="addColumnMenu"
                >
                  <mat-icon>add</mat-icon>Column
                </button>
                <button matButton type="button" (click)="resetColumns()">
                  <mat-icon>restart_alt</mat-icon>Back to automatic
                </button>
              </div>
              <mat-menu #addColumnMenu="matMenu">
                <button mat-menu-item (click)="addComputed()">
                  <mat-icon>calculate</mat-icon>Computed column
                </button>
                @for (key of unusedKeys(); track key) {
                  <button mat-menu-item (click)="addColumn(key)">
                    <mat-icon>notes</mat-icon>{{ key }}
                  </button>
                }
              </mat-menu>
            </div>
          }
        </mat-expansion-panel>

        <!-- Row actions -->
        <mat-expansion-panel [expanded]="t.rowActions.length > 0">
          <mat-expansion-panel-header>
            <mat-panel-title class="ui-gap-2"
              ><mat-icon class="ui-icon-sm">more_horiz</mat-icon>Row
              actions</mat-panel-title
            >
            @if (t.rowActions.length) {
              <mat-panel-description>{{
                t.rowActions.length
              }}</mat-panel-description>
            }
          </mat-expansion-panel-header>
          <p class="mat-font-body-sm mat-text-on-surface-variant ui-mt-0">
            Buttons in every row. Their steps use
            <code>{{ '{{row.…}}' }}</code> — open a dialog with the row, call an
            API with <code>{{ '{{row.id}}' }}</code>, update or delete the
            record.
          </p>
          <div class="ui-column ui-gap-3">
            @for (action of t.rowActions; track action.id) {
              <div class="wb-action ui-column ui-gap-2 ui-p-3">
                <div class="wb-option-grid">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                    ><mat-label>Label</mat-label
                    ><input
                      matInput
                      [value]="action.label"
                      (input)="
                        patchRowAction(action.id, {
                          label: $any($event.target).value,
                        })
                      "
                  /></mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                    ><mat-label>Icon</mat-label
                    ><input
                      matInput
                      [value]="action.icon"
                      (input)="
                        patchRowAction(action.id, {
                          icon: $any($event.target).value,
                        })
                      "
                    /><mat-icon matSuffix>{{
                      action.icon
                    }}</mat-icon></mat-form-field
                  >
                </div>
                <div class="ui-row ui-align-center ui-gap-3 ui-wrap">
                  <mat-button-toggle-group
                    [value]="action.display"
                    (change)="
                      patchRowAction(action.id, { display: $event.value })
                    "
                    hideSingleSelectionIndicator
                    aria-label="Button style"
                  >
                    <mat-button-toggle value="icon">Icon</mat-button-toggle
                    ><mat-button-toggle value="text">Text</mat-button-toggle>
                  </mat-button-toggle-group>
                  <mat-slide-toggle
                    [checked]="!!action.danger"
                    (change)="
                      patchRowAction(action.id, {
                        danger: $event.checked || undefined,
                      })
                    "
                    >Destructive</mat-slide-toggle
                  >
                </div>
                @if (action.visible) {
                  <span class="mat-font-label-lg">Show for rows where</span>
                  <wb-expr-editor
                    [expr]="action.visible"
                    purpose="condition"
                    [paths]="rowPaths()"
                    [valuePaths]="rowPaths()"
                    [scope]="sampleScope()"
                    (exprChange)="
                      patchRowAction(action.id, { visible: $event })
                    "
                  />
                } @else {
                  <button
                    matButton
                    type="button"
                    class="ui-self-start"
                    (click)="
                      patchRowAction(action.id, { visible: emptyCondition() })
                    "
                  >
                    <mat-icon>rule</mat-icon>Only for some rows…
                  </button>
                }
                <div class="ui-row ui-align-center">
                  <span class="mat-font-label-lg ui-grow">Steps</span>
                  <button
                    matButton
                    type="button"
                    [matMenuTriggerFor]="stepMenu"
                    [matMenuTriggerData]="{ id: action.id }"
                  >
                    <mat-icon>add</mat-icon>Step
                  </button>
                </div>
                @for (
                  step of action.actions;
                  track step.id;
                  let i = $index;
                  let lastStep = $last
                ) {
                  <wb-action-editor
                    [action]="step"
                    [index]="i"
                    [last]="lastStep"
                    [depth]="1"
                  />
                } @empty {
                  <p
                    class="mat-font-body-sm mat-text-on-surface-variant ui-m-0"
                  >
                    No steps yet.
                  </p>
                }
                <button
                  matButton
                  type="button"
                  class="ui-self-end"
                  (click)="removeRowAction(action.id)"
                >
                  <mat-icon>delete_outline</mat-icon>Remove button
                </button>
              </div>
            }
            <button
              matButton="tonal"
              type="button"
              class="ui-self-start"
              [matMenuTriggerFor]="presetMenu"
            >
              <mat-icon>add</mat-icon>Row action
            </button>
            <mat-menu #presetMenu="matMenu">
              <button mat-menu-item (click)="addRowAction('view')">
                <mat-icon>visibility</mat-icon>View (opens a dialog)
              </button>
              <button mat-menu-item (click)="addRowAction('edit')">
                <mat-icon>edit</mat-icon>Edit (opens a dialog)
              </button>
              <button mat-menu-item (click)="addRowAction('delete')">
                <mat-icon>delete</mat-icon>Delete (asks first)
              </button>
              <button mat-menu-item (click)="addRowAction('custom')">
                <mat-icon>bolt</mat-icon>Custom
              </button>
            </mat-menu>
            <mat-menu #changeMenu="matMenu">
              <ng-template matMenuContent let-id="id">
                @for (type of actionTypes; track type.type) {
                  <button
                    mat-menu-item
                    (click)="store.addColumnChangeStep(id, type.type)"
                  >
                    <mat-icon>{{ type.icon }}</mat-icon
                    ><span>{{ type.label }}</span>
                  </button>
                }
              </ng-template>
            </mat-menu>
            <mat-menu #stepMenu="matMenu">
              <ng-template matMenuContent let-id="id">
                @for (type of actionTypes; track type.type) {
                  <button
                    mat-menu-item
                    (click)="store.addRowActionStep(id, type.type)"
                  >
                    <mat-icon>{{ type.icon }}</mat-icon
                    ><span>{{ type.label }}</span>
                  </button>
                }
              </ng-template>
            </mat-menu>
            <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
              Clicking a whole row runs the
              <strong>On row click</strong> actions in the Logic tab.
            </p>
          </div>
        </mat-expansion-panel>

        <!-- Merges -->
        <mat-expansion-panel
          [expanded]="t.merges.length > 0 || t.headerGroups.length > 0"
        >
          <mat-expansion-panel-header>
            <mat-panel-title class="ui-gap-2"
              ><mat-icon class="ui-icon-sm">table_rows</mat-icon>Merges &amp;
              groups</mat-panel-title
            >
            @if (t.merges.length + t.headerGroups.length) {
              <mat-panel-description>{{
                t.merges.length + t.headerGroups.length
              }}</mat-panel-description>
            }
          </mat-expansion-panel-header>
          @if (!t.columns.length) {
            <p class="mat-font-body-sm mat-text-on-surface-variant ui-mt-0">
              Customize the columns first — merges and groups refer to them.
            </p>
            <button matButton="tonal" type="button" (click)="customize()">
              <mat-icon>tune</mat-icon>Customize columns
            </button>
          } @else {
            <div class="ui-column ui-gap-3">
              <span class="mat-font-label-lg">Header groups</span>
              @for (group of t.headerGroups; track group.id) {
                <div class="wb-action ui-column ui-gap-2 ui-p-3">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"
                    ><mat-label>Group label</mat-label
                    ><input
                      matInput
                      [value]="group.label"
                      (input)="
                        patchGroup(group.id, {
                          label: $any($event.target).value,
                        })
                      "
                  /></mat-form-field>
                  <div class="wb-option-grid">
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                    >
                      <mat-label>Starts at column</mat-label>
                      <mat-select
                        [value]="group.column"
                        (selectionChange)="
                          patchGroup(group.id, { column: $event.value })
                        "
                      >
                        @for (column of t.columns; track column.id) {
                          <mat-option [value]="column.id">{{
                            column.header || column.field
                          }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      ><mat-label>Columns</mat-label
                      ><input
                        matInput
                        type="number"
                        min="1"
                        [value]="group.span"
                        (input)="
                          patchGroup(group.id, {
                            span: +$any($event.target).value,
                          })
                        "
                    /></mat-form-field>
                  </div>
                  <button
                    matButton
                    type="button"
                    class="ui-self-end"
                    (click)="removeGroup(group.id)"
                  >
                    <mat-icon>delete_outline</mat-icon>Remove
                  </button>
                </div>
              }
              <button
                matButton
                type="button"
                class="ui-self-start"
                (click)="addGroup()"
              >
                <mat-icon>add</mat-icon>Header group
              </button>

              <span class="mat-font-label-lg">Merged cells</span>
              <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
                Fixed rows (designed) or every row matching a condition
                (data-driven). Use <code>{{ '{{prev.…}}' }}</code> and
                <code>{{ '{{next.…}}' }}</code> to compare with neighbours.
              </p>
              @for (merge of t.merges; track merge.id) {
                <div class="wb-action ui-column ui-gap-2 ui-p-3">
                  <mat-form-field
                    appearance="outline"
                    subscriptSizing="dynamic"
                  >
                    <mat-label>Cell in column</mat-label>
                    <mat-select
                      [value]="merge.column"
                      (selectionChange)="
                        patchMerge(merge.id, { column: $event.value })
                      "
                    >
                      @for (column of t.columns; track column.id) {
                        <mat-option [value]="column.id">{{
                          column.header || column.field
                        }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <div class="wb-option-grid">
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      ><mat-label>Spans columns</mat-label
                      ><input
                        matInput
                        type="number"
                        min="1"
                        [value]="merge.colspan"
                        (input)="
                          patchMerge(merge.id, {
                            colspan: +$any($event.target).value,
                          })
                        "
                    /></mat-form-field>
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      ><mat-label>Spans rows</mat-label
                      ><input
                        matInput
                        type="number"
                        min="1"
                        [value]="merge.rowspan"
                        (input)="
                          patchMerge(merge.id, {
                            rowspan: +$any($event.target).value,
                          })
                        "
                    /></mat-form-field>
                  </div>
                  <mat-button-toggle-group
                    [value]="merge.when ? 'when' : 'rows'"
                    (change)="mergeMode(merge.id, $event.value)"
                    hideSingleSelectionIndicator
                    aria-label="Merge applies to"
                    class="ui-fill"
                  >
                    <mat-button-toggle value="rows"
                      >Fixed rows</mat-button-toggle
                    ><mat-button-toggle value="when"
                      >Rows matching</mat-button-toggle
                    >
                  </mat-button-toggle-group>
                  @if (merge.when) {
                    <wb-expr-editor
                      [expr]="merge.when"
                      purpose="condition"
                      [paths]="rowPaths()"
                      [valuePaths]="rowPaths()"
                      [scope]="sampleScope()"
                      [clearable]="false"
                      (exprChange)="patchMerge(merge.id, { when: $event })"
                    />
                  } @else {
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      ><mat-label>Rows</mat-label
                      ><input
                        matInput
                        [value]="merge.rows ?? ''"
                        placeholder="1, 3-4"
                        (input)="
                          patchMerge(merge.id, {
                            rows: $any($event.target).value,
                          })
                        "
                      /><mat-hint
                        >Row numbers from 1, as shown</mat-hint
                      ></mat-form-field
                    >
                  }
                  <button
                    matButton
                    type="button"
                    class="ui-self-end"
                    (click)="removeMerge(merge.id)"
                  >
                    <mat-icon>delete_outline</mat-icon>Remove
                  </button>
                </div>
              }
              <button
                matButton
                type="button"
                class="ui-self-start"
                (click)="addMerge()"
              >
                <mat-icon>add</mat-icon>Merge
              </button>
            </div>
          }
        </mat-expansion-panel>

        <!-- Row highlight -->
        <mat-expansion-panel [expanded]="!!t.rowTones?.length">
          <mat-expansion-panel-header>
            <mat-panel-title class="ui-gap-2"
              ><mat-icon class="ui-icon-sm">format_color_fill</mat-icon
              >Highlight rows</mat-panel-title
            >
            @if (t.rowTones?.length) {
              <mat-panel-description>{{
                t.rowTones.length
              }}</mat-panel-description>
            }
          </mat-expansion-panel-header>
          <ng-container
            *ngTemplateOutlet="
              tones;
              context: { rules: t.rowTones ?? [], set: rowTonesSetter }
            "
          />
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="ui-mt-3 ui-fill"
          >
            <mat-label>Text when there are no rows</mat-label>
            <input
              matInput
              [value]="t.emptyText ?? ''"
              placeholder="No rows yet."
              (input)="setEmptyText($any($event.target).value)"
            />
          </mat-form-field>
        </mat-expansion-panel>
      </mat-accordion>
    </section>

    <ng-template #tones let-rules="rules" let-set="set">
      <div class="ui-column ui-gap-2">
        @for (rule of rules; track rule.id; let i = $index) {
          <div class="wb-action ui-column ui-gap-2 ui-p-2">
            <div class="ui-row ui-align-center ui-gap-2">
              <mat-form-field
                appearance="outline"
                subscriptSizing="dynamic"
                class="ui-grow"
              >
                <mat-label>Tone</mat-label>
                <mat-select
                  [value]="rule.tone"
                  (selectionChange)="
                    set(editTone(rules, i, { tone: $event.value }))
                  "
                >
                  @for (tone of toneOptions; track tone.value) {
                    <mat-option [value]="tone.value"
                      ><span
                        [class]="
                          'wb-badge wb-tone-' + (tone.value || 'neutral')
                        "
                        >{{ tone.label }}</span
                      ></mat-option
                    >
                  }
                </mat-select>
              </mat-form-field>
              <button
                matIconButton
                type="button"
                class="wb-icon-button-sm"
                aria-label="Remove highlight"
                (click)="set(removeTone(rules, i))"
              >
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
            <wb-expr-editor
              [expr]="rule.when"
              purpose="condition"
              [paths]="rowPaths()"
              [valuePaths]="rowPaths()"
              [scope]="sampleScope()"
              [clearable]="false"
              (exprChange)="set(editTone(rules, i, { when: $event }))"
            />
          </div>
        }
        <button
          matButton
          type="button"
          class="ui-self-start"
          (click)="set(addTone(rules))"
        >
          <mat-icon>add</mat-icon>Highlight when…
        </button>
      </div>
    </ng-template>
  `,
})
export class TablePanel {
  readonly block = input.required<Block>()
  readonly store = inject(BuilderStore)
  readonly runtime = inject(SiteRuntime)
  readonly formats = COLUMN_FORMATS
  readonly cellKinds = CELL_KINDS
  readonly toneOptions = TONES.filter((tone) => tone.value)
  readonly actionTypes = ACTION_DEFINITIONS
  readonly widths = [
    { value: '', label: 'Auto' },
    { value: 'xs', label: 'Extra small' },
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
    { value: 'xl', label: 'Extra large' },
  ]

  readonly table = computed<TableConfig>(
    () => this.block().table ?? emptyTable(),
  )
  readonly sourceId = computed(() => String(this.block().props['source'] ?? ''))
  private readonly rows = computed(() =>
    this.sourceId() ? this.runtime.rowsFor(this.sourceId()) : [],
  )
  readonly rowKeys = computed(() => {
    if (this.sourceId()) return Object.keys(this.rows()[0] ?? {})
    const [header = []] = lines(String(this.block().props['items'] ?? ''))
    return header.map((_, index) => `c${index}`)
  })
  readonly unusedKeys = computed(() => {
    const used = new Set(this.table().columns.map((column) => column.field))
    return this.rowKeys().filter((key) => !used.has(key))
  })
  readonly pagePaths = computed(() =>
    scopePaths(
      this.store.project(),
      this.store.page(),
      (id) => Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
      this.block(),
    ),
  )
  readonly rowPaths = computed<PathOption[]>(() => [
    ...this.rowKeys().map((key) => ({
      path: `row.${key}`,
      label: `row ${key}`,
      group: 'Row' as const,
    })),
    { path: 'value', label: 'this cell’s value', group: 'Row' },
    { path: 'index', label: 'row position (from 0)', group: 'Row' },
    ...this.rowKeys()
      .slice(0, 12)
      .map((key) => ({
        path: `prev.${key}`,
        label: `previous row ${key}`,
        group: 'Row' as const,
      })),
    ...this.rowKeys()
      .slice(0, 12)
      .map((key) => ({
        path: `next.${key}`,
        label: `next row ${key}`,
        group: 'Row' as const,
      })),
    ...this.pagePaths(),
  ])
  /** Preview scope: the first row of the data. */
  readonly sampleScope = computed(() => ({
    ...this.runtime.scope(),
    row: this.rows()[0] ?? {},
    index: 0,
    prev: null,
    next: this.rows()[1] ?? null,
  }))

  readonly rowTonesSetter = (rules: ToneRule[]) =>
    this.update(
      (table) => ({ ...table, rowTones: rules.length ? rules : undefined }),
      'rowTones',
    )

  private update(
    fn: (table: TableConfig) => TableConfig | false,
    key?: string,
  ): void {
    this.store.updateTable(fn, key)
  }

  formatIcon(column: TableColumn): string {
    return (
      COLUMN_FORMATS.find((format) => format.value === column.format)?.icon ??
      'notes'
    )
  }

  cellLabel(column: TableColumn): string {
    return (
      CELL_KINDS.find(
        (kind) => kind.value === column.cell,
      )?.label.toLowerCase() ?? ''
    )
  }

  editable(column: TableColumn): boolean {
    return isEditableCell(column.cell)
  }

  cellHint(column: TableColumn): string {
    return (
      CELL_KINDS.find((kind) => kind.value === (column.cell || 'display'))
        ?.hint ?? ''
    )
  }

  optionsMode(column: TableColumn, mode: 'list' | 'expr'): void {
    if (mode === 'expr')
      this.patchColumn(column, { optionsExpr: { kind: 'template', text: '' } })
    else this.patchColumn(column, { optionsExpr: undefined })
  }

  emptyCondition(): Expr {
    return { kind: 'conditions', group: { combinator: 'and', conditions: [] } }
  }

  customize(): void {
    const listed = lines(String(this.block().props['columns'] ?? ''))
    const items = !this.sourceId()
      ? (lines(String(this.block().props['items'] ?? ''))[0] ?? [])
      : []
    const columns = listed.length
      ? listed.map(([field, header]) => createColumn(field, header))
      : items.length
        ? items.map((label, index) => createColumn(`c${index}`, label))
        : this.rowKeys()
            .filter((key) => key !== 'id')
            .map((key) => createColumn(key, key))
    this.update((table) => ({ ...table, columns }))
  }

  resetColumns(): void {
    this.update((table) => ({
      ...table,
      columns: [],
      merges: [],
      headerGroups: [],
    }))
  }

  addColumn(field: string): void {
    this.update((table) => ({
      ...table,
      columns: [...table.columns, createColumn(field, field)],
    }))
  }

  addComputed(): void {
    const column = createColumn('', 'Computed')
    column.value = {
      kind: 'template',
      text: this.rowKeys()
        .slice(0, 2)
        .map((key) => `{{row.${key}}}`)
        .join(' '),
    }
    this.update((table) => ({ ...table, columns: [...table.columns, column] }))
  }

  patchColumn(column: TableColumn, patch: Partial<TableColumn>): void {
    this.update((table) => {
      const target = table.columns.find((item) => item.id === column.id)
      if (!target) return false
      Object.assign(target, patch)
      for (const key of Object.keys(patch) as (keyof TableColumn)[])
        if (patch[key] === undefined) delete target[key]
      return table
    }, `column:${column.id}`)
  }

  formatOption(column: TableColumn, key: string, value: string): void {
    const options = { ...(column.formatOptions ?? {}) }
    if (value === '') delete options[key]
    else options[key] = value
    this.patchColumn(column, {
      formatOptions: Object.keys(options).length ? options : undefined,
    })
  }

  tonesSetter(column: TableColumn) {
    return (rules: ToneRule[]) =>
      this.patchColumn(column, { tones: rules.length ? rules : undefined })
  }

  addTone(rules: ToneRule[]): ToneRule[] {
    return [...rules, createToneRule(`row.${this.rowKeys()[0] ?? 'status'}`)]
  }
  editTone(
    rules: ToneRule[],
    index: number,
    patch: Partial<ToneRule>,
  ): ToneRule[] {
    return rules.map((rule, position) =>
      position === index ? { ...rule, ...patch } : rule,
    )
  }
  removeTone(rules: ToneRule[], index: number): ToneRule[] {
    return rules.filter((_, position) => position !== index)
  }

  moveColumn(column: TableColumn, delta: number): void {
    this.update((table) => {
      const index = table.columns.findIndex((item) => item.id === column.id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= table.columns.length)
        return false
      ;[table.columns[index], table.columns[target]] = [
        table.columns[target],
        table.columns[index],
      ]
      return table
    })
  }

  removeColumn(column: TableColumn): void {
    this.update((table) => ({
      ...table,
      columns: table.columns.filter((item) => item.id !== column.id),
      merges: table.merges.filter((item) => item.column !== column.id),
      headerGroups: table.headerGroups.filter(
        (item) => item.column !== column.id,
      ),
    }))
  }

  addRowAction(preset: RowActionPreset): void {
    const dialogId = this.store.dialogs()[0]?.id
    const source = this.store
      .project()
      .dataSources.find((item) => item.id === this.sourceId())
    const collectionId =
      source && source.kind !== 'rest' ? source.id : undefined
    this.update((table) => ({
      ...table,
      rowActions: [
        ...table.rowActions,
        createRowAction(preset, { dialogId, collectionId }),
      ].slice(0, 8),
    }))
  }

  patchRowAction(
    id: string,
    patch: Partial<TableConfig['rowActions'][number]>,
  ): void {
    this.update((table) => {
      const target = table.rowActions.find((item) => item.id === id)
      if (!target) return false
      Object.assign(target, patch)
      for (const key of Object.keys(patch) as (keyof typeof patch)[])
        if (patch[key] === undefined) delete target[key]
      return table
    }, `rowAction:${id}`)
  }

  removeRowAction(id: string): void {
    this.update((table) => ({
      ...table,
      rowActions: table.rowActions.filter((item) => item.id !== id),
    }))
  }

  addGroup(): void {
    const first = this.table().columns[0]
    if (first)
      this.update((table) => ({
        ...table,
        headerGroups: [...table.headerGroups, createHeaderGroup(first.id)],
      }))
  }
  patchGroup(
    id: string,
    patch: Partial<TableConfig['headerGroups'][number]>,
  ): void {
    this.update((table) => {
      const target = table.headerGroups.find((item) => item.id === id)
      if (!target) return false
      Object.assign(target, patch)
      return table
    }, `group:${id}`)
  }
  removeGroup(id: string): void {
    this.update((table) => ({
      ...table,
      headerGroups: table.headerGroups.filter((item) => item.id !== id),
    }))
  }

  addMerge(): void {
    const first = this.table().columns[0]
    if (first)
      this.update((table) => ({
        ...table,
        merges: [...table.merges, createMerge(first.id)],
      }))
  }
  patchMerge(id: string, patch: Partial<TableConfig['merges'][number]>): void {
    this.update((table) => {
      const target = table.merges.find((item) => item.id === id)
      if (!target) return false
      Object.assign(target, patch)
      return table
    }, `merge:${id}`)
  }
  mergeMode(id: string, mode: 'rows' | 'when'): void {
    this.update((table) => {
      const target = table.merges.find((item) => item.id === id)
      if (!target) return false
      if (mode === 'when') {
        target.when = {
          kind: 'conditions',
          group: {
            combinator: 'and',
            conditions: [
              {
                field: `row.${this.rowKeys()[0] ?? 'type'}`,
                operator: 'eq',
                value: '',
                source: 'literal',
              },
            ],
          },
        }
        delete target.rows
      } else {
        delete target.when
        target.rows = '1'
      }
      return table
    })
  }
  removeMerge(id: string): void {
    this.update((table) => ({
      ...table,
      merges: table.merges.filter((item) => item.id !== id),
    }))
  }

  setEmptyText(text: string): void {
    this.update(
      (table) => ({ ...table, emptyText: text || undefined }),
      'emptyText',
    )
  }
}
