import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from '@angular/core'
import { MatMenuModule } from '@angular/material/menu'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import {
  ACTION_DEFINITIONS,
  Action,
  actionDefinition,
  fieldName,
  isFormField,
} from '../../core/model'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { ExprEditor } from './logic/expr-editor'
import { PathOption, scopePaths } from './logic/scope-paths'
import { BuilderStore } from './builder-store'

/** Configures one step of an event handler (target and value depend on the action type). */
@Component({
  selector: 'wb-action-editor',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatSlideToggleModule,
    ExprEditor,
    forwardRef(() => ActionEditor),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = action();
    @let def = definition();
    @let o = a.options ?? {};
    <div
      class="wb-action ui-column ui-gap-2 ui-p-3"
      [class.wb-action-nested]="depth() > 0"
    >
      <div class="ui-row ui-align-center ui-gap-2">
        <mat-icon class="mat-text-primary ui-icon-sm">{{ def?.icon }}</mat-icon>
        <span class="mat-font-title-sm ui-grow"
          >{{ depth() ? '' : index() + 1 + '. ' }}{{ def?.label }}</span
        >
        <button
          matIconButton
          type="button"
          class="wb-icon-button-sm"
          matTooltip="Move up"
          aria-label="Move action up"
          [disabled]="index() === 0"
          (click)="store.moveAction(a.id, -1, pageLevel())"
        >
          <mat-icon>arrow_upward</mat-icon>
        </button>
        <button
          matIconButton
          type="button"
          class="wb-icon-button-sm"
          matTooltip="Move down"
          aria-label="Move action down"
          [disabled]="last()"
          (click)="store.moveAction(a.id, 1, pageLevel())"
        >
          <mat-icon>arrow_downward</mat-icon>
        </button>
        <button
          matIconButton
          type="button"
          class="wb-icon-button-sm"
          matTooltip="Remove"
          aria-label="Remove action"
          (click)="store.removeAction(a.id, pageLevel())"
        >
          <mat-icon>delete_outline</mat-icon>
        </button>
      </div>
      @switch (def?.target) {
        @case ('page') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (page of store.project().pages; track page.id) {
                <mat-option [value]="page.id">{{ page.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @case ('dialog') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (dialog of store.dialogs(); track dialog.id) {
                <mat-option [value]="dialog.id">{{ dialog.name }}</mat-option>
              }
            </mat-select>
            @if (!store.dialogs().length) {
              <mat-hint>Add a Dialog block to this page first.</mat-hint>
            }
          </mat-form-field>
        }
        @case ('variable') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (variable of store.project().variables; track variable.id) {
                <mat-option [value]="variable.id">{{
                  variable.name
                }}</mat-option>
              }
            </mat-select>
            @if (!store.project().variables.length) {
              <mat-hint>Create variables in the Data panel.</mat-hint>
            }
          </mat-form-field>
        }
        @case ('source') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (source of store.project().dataSources; track source.id) {
                <mat-option [value]="source.id">{{ source.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @case ('collection') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (source of collections(); track source.id) {
                <mat-option [value]="source.id">{{ source.name }}</mat-option>
              }
            </mat-select>
            @if (!collections().length) {
              <mat-hint
                >Create a Collection data source in the Data panel.</mat-hint
              >
            }
          </mat-form-field>
        }
        @case ('field') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (name of fieldNames(); track name) {
                <mat-option [value]="name">{{ name }}</mat-option>
              }
            </mat-select>
            @if (!fieldNames().length) {
              <mat-hint>Add form fields to this page first.</mat-hint>
            }
          </mat-form-field>
        }
        @case ('mutation') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (source of mutations(); track source.id) {
                <mat-option [value]="source.id"
                  >{{ source.method }} · {{ source.name }}</mat-option
                >
              }
            </mat-select>
            @if (!mutations().length) {
              <mat-hint
                >Create an API data source with mode “Action” in the Data
                panel.</mat-hint
              >
            } @else {
              <mat-hint
                >Sent through a queue: retried on failure, kept while
                offline.</mat-hint
              >
            }
          </mat-form-field>
        }
        @case ('block') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (layer of store.layers(); track layer.block.id) {
                <mat-option [value]="layer.block.id">{{
                  layer.block.name
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @case ('workflow') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <mat-select
              [value]="a.target"
              (selectionChange)="update({ target: $event.value })"
            >
              @for (workflow of workflows(); track workflow.id) {
                <mat-option [value]="workflow.id">{{
                  workflow.name
                }}</mat-option>
              }
            </mat-select>
            @if (!workflows().length) {
              <mat-hint>Create workflows in the Logic panel (left).</mat-hint>
            }
          </mat-form-field>
          @if (selectedWorkflow(); as workflow) {
            @for (param of workflow.params; track param.name) {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Input: {{ param.name }}</mat-label>
                <input
                  matInput
                  [value]="o['in_' + param.name] ?? ''"
                  [placeholder]="
                    param.defaultValue
                      ? 'default ' + param.defaultValue
                      : '{{fields.…}}'
                  "
                  (input)="
                    option('in_' + param.name, $any($event.target).value)
                  "
                />
                <button
                  matIconButton
                  matSuffix
                  type="button"
                  [matMenuTriggerFor]="valueMenu"
                  [matMenuTriggerData]="{ key: 'in_' + param.name }"
                  aria-label="Insert a value"
                >
                  <mat-icon>add_circle</mat-icon>
                </button>
              </mat-form-field>
            }
          }
        }
        @case ('url') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.targetLabel }}</mat-label>
            <input
              matInput
              [value]="a.target"
              (input)="update({ target: $any($event.target).value })"
              placeholder="https://…"
            />
            @if (a.type === 'submitForm') {
              <mat-hint>Form values are sent as JSON.</mat-hint>
            }
          </mat-form-field>
        }
      }
      @switch (def?.value) {
        @case ('text') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.valueLabel }}</mat-label>
            <input
              matInput
              [value]="a.value"
              (input)="update({ value: $any($event.target).value })"
            />
          </mat-form-field>
        }
        @case ('newTab') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Open in</mat-label>
            <mat-select
              [value]="a.value || 'new'"
              (selectionChange)="update({ value: $event.value })"
            >
              <mat-option value="new">New tab</mat-option
              ><mat-option value="same">Same tab</mat-option>
            </mat-select>
          </mat-form-field>
        }
        @case ('number') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.valueLabel }}</mat-label>
            <input
              matInput
              type="number"
              min="0"
              max="30000"
              step="100"
              [value]="a.value"
              (input)="update({ value: $any($event.target).value })"
            />
          </mat-form-field>
        }
        @case ('method') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ def?.valueLabel }}</mat-label>
            <mat-select
              [value]="a.value || 'POST'"
              (selectionChange)="update({ value: $event.value })"
            >
              <mat-option value="POST">POST</mat-option
              ><mat-option value="PUT">PUT</mat-option>
            </mat-select>
          </mat-form-field>
        }
      }
      @if (a.type === 'compute') {
        <wb-expr-editor
          [expr]="a.expr"
          purpose="value"
          [paths]="paths()"
          [valuePaths]="paths()"
          [scope]="runtime.scope()"
          [clearable]="false"
          (exprChange)="update({ expr: $event })"
        />
      }
      @if (a.type === 'parallel') {
        <div class="ui-row ui-align-center ui-gap-2">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="ui-grow"
          >
            <mat-label>When a branch fails</mat-label>
            <mat-select
              [value]="o['mode'] || 'all'"
              (selectionChange)="
                option('mode', $event.value === 'all' ? '' : $event.value)
              "
            >
              <mat-option value="all">Stop (the step fails)</mat-option>
              <mat-option value="settled">Carry on with the results</mat-option>
            </mat-select>
          </mat-form-field>
          <button
            matButton
            type="button"
            (click)="store.addParallelBranch(a.id, pageLevel())"
          >
            <mat-icon>add</mat-icon>Branch
          </button>
        </div>
        @for (branch of a.branches ?? []; track $index; let b = $index) {
          <div class="wb-branch wb-branch-parallel">
            <div class="ui-row ui-align-center ui-gap-2">
              <mat-icon class="ui-icon-sm wb-branch-icon">call_split</mat-icon>
              <span class="mat-font-label-lg ui-grow">Branch {{ b + 1 }}</span>
              <button
                matButton
                type="button"
                [matMenuTriggerFor]="parallelMenu"
                [matMenuTriggerData]="{ branch: b }"
              >
                <mat-icon>add</mat-icon>Step
              </button>
              <button
                matIconButton
                type="button"
                class="wb-icon-button-sm"
                aria-label="Remove branch"
                (click)="store.removeParallelBranch(a.id, b, pageLevel())"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
            @for (
              child of branch;
              track child.id;
              let childIndex = $index;
              let childLast = $last
            ) {
              <wb-action-editor
                [action]="child"
                [index]="childIndex"
                [last]="childLast"
                [pageLevel]="pageLevel()"
                [depth]="depth() + 1"
              />
            } @empty {
              <span class="mat-font-body-sm mat-text-on-surface-variant"
                >No steps yet.</span
              >
            }
          </div>
        }
        <mat-menu #parallelMenu="matMenu">
          <ng-template matMenuContent let-branch="branch">
            @for (type of actionTypes; track type.type) {
              <button
                mat-menu-item
                (click)="
                  store.addParallelStep(a.id, branch, type.type, pageLevel())
                "
              >
                <mat-icon>{{ type.icon }}</mat-icon
                ><span>{{ type.label }}</span>
              </button>
            }
          </ng-template>
        </mat-menu>
      }
      @if (def?.responseHint) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Save result as (optional)</mat-label>
          <input
            matInput
            [value]="o['saveAs'] ?? ''"
            placeholder="e.g. order"
            (input)="saveAs($any($event.target).value)"
          />
          <mat-hint
            >{{ o['saveAs'] ? 'Later steps read {{steps.' + o['saveAs'] + '…}}'
            : 'Lets later steps read this result as {{ steps.name }}'
            }}</mat-hint
          >
        </mat-form-field>
      }
      <mat-menu #valueMenu="matMenu">
        <ng-template matMenuContent let-key="key">
          @for (path of paths(); track path.path) {
            <button
              mat-menu-item
              (click)="option(key, '{{' + path.path + '}}')"
            >
              <span class="wb-logic-chip">{{ path.group }}</span>
              {{ path.label }}
            </button>
          }
        </ng-template>
      </mat-menu>
      @if (a.type === 'showMessage') {
        <div class="wb-option-grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Type</mat-label>
            <mat-select
              [value]="o['severity'] || 'info'"
              (selectionChange)="option('severity', $event.value)"
            >
              @for (severity of severities; track severity.value) {
                <mat-option [value]="severity.value"
                  ><mat-icon [class]="'wb-toast-icon-' + severity.value">{{
                    severity.icon
                  }}</mat-icon
                  >{{ severity.label }}</mat-option
                >
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Position</mat-label>
            <mat-select
              [value]="o['position'] || 'bottom-center'"
              (selectionChange)="option('position', $event.value)"
            >
              @for (position of positions; track position.value) {
                <mat-option [value]="position.value">{{
                  position.label
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Title (optional)</mat-label>
            <input
              matInput
              [value]="o['title'] ?? ''"
              (input)="option('title', $any($event.target).value)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Seconds (0 = stay)</mat-label>
            <input
              matInput
              type="number"
              min="0"
              max="60"
              [value]="o['duration'] ?? ''"
              placeholder="4"
              (input)="option('duration', $any($event.target).value)"
            />
          </mat-form-field>
        </div>
      }
      @if (a.type === 'confirm') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Title</mat-label>
          <input
            matInput
            [value]="o['title'] ?? ''"
            placeholder="Are you sure?"
            (input)="option('title', $any($event.target).value)"
          />
        </mat-form-field>
        <div class="wb-option-grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Confirm button</mat-label>
            <input
              matInput
              [value]="o['confirmLabel'] ?? ''"
              placeholder="Confirm"
              (input)="option('confirmLabel', $any($event.target).value)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Cancel button</mat-label>
            <input
              matInput
              [value]="o['cancelLabel'] ?? ''"
              placeholder="Cancel"
              (input)="option('cancelLabel', $any($event.target).value)"
            />
          </mat-form-field>
        </div>
        <mat-slide-toggle
          [checked]="o['danger'] === 'true'"
          (change)="option('danger', $event.checked ? 'true' : '')"
          >Destructive (red confirm button)</mat-slide-toggle
        >
      }
      @if (def?.outcomes; as outcomes) {
        @for (branch of branches; track branch.key; let i = $index) {
          <div class="wb-branch" [class.wb-branch-error]="i === 1">
            <div class="ui-row ui-align-center ui-gap-2">
              <mat-icon class="ui-icon-sm wb-branch-icon">{{
                i === 0 ? 'subdirectory_arrow_right' : 'report'
              }}</mat-icon>
              <span class="mat-font-label-lg ui-grow">{{ outcomes[i] }}</span>
              @if (depth() < 3) {
                <button
                  matButton
                  type="button"
                  [matMenuTriggerFor]="stepMenu"
                  [matMenuTriggerData]="{ branch: branch.key }"
                >
                  <mat-icon>add</mat-icon>Step
                </button>
              }
            </div>
            @if (i === 0 && def?.responseHint) {
              <span class="mat-font-body-sm mat-text-on-surface-variant"
                >Use <code>{{ '{{response…}}' }}</code> for
                {{ def?.responseHint }}.</span
              >
            }
            @if (i === 1 && a.type !== 'confirm') {
              <span class="mat-font-body-sm mat-text-on-surface-variant"
                >Use <code>{{ '{{error.message}}' }}</code>,
                <code>{{ '{{error.status}}' }}</code>. Field errors from the
                server appear on the form automatically; with no steps here an
                error notification is shown.</span
              >
            }
            @for (
              child of a[branch.key] ?? [];
              track child.id;
              let childIndex = $index;
              let childLast = $last
            ) {
              <wb-action-editor
                [action]="child"
                [index]="childIndex"
                [last]="childLast"
                [pageLevel]="pageLevel()"
                [depth]="depth() + 1"
              />
            }
            @if (i === 1) {
              <mat-slide-toggle
                [checked]="o['continueOnError'] === 'true'"
                (change)="
                  option('continueOnError', $event.checked ? 'true' : '')
                "
                >Then continue with the next steps</mat-slide-toggle
              >
            }
          </div>
        }
        <mat-menu #stepMenu="matMenu">
          <ng-template matMenuContent let-branch="branch">
            @for (type of actionTypes; track type.type) {
              <button
                mat-menu-item
                (click)="
                  store.addBranchAction(a.id, branch, type.type, pageLevel())
                "
              >
                <mat-icon>{{ type.icon }}</mat-icon
                ><span>{{ type.label }}</span>
              </button>
            }
          </ng-template>
        </mat-menu>
      }
      @if (a.when) {
        <div class="ui-column ui-gap-1">
          <span class="mat-font-label-lg">Only if</span>
          <wb-expr-editor
            [expr]="a.when"
            purpose="condition"
            [paths]="paths()"
            [valuePaths]="paths()"
            [scope]="runtime.scope()"
            (exprChange)="update({ when: $event })"
          />
        </div>
      } @else {
        <button
          matButton
          type="button"
          class="ui-self-start"
          (click)="
            update({
              when: {
                kind: 'conditions',
                group: { combinator: 'and', conditions: [] },
              },
            })
          "
        >
          <mat-icon>rule</mat-icon>Only if…
        </button>
      }
    </div>
  `,
})
export class ActionEditor {
  readonly action = input.required<Action>()
  readonly index = input(0)
  readonly last = input(false)
  /** Owner of the action: false = selected block, true = page, string = workflow id. */
  readonly pageLevel = input<boolean | string>(false)
  /** Nesting level inside success/error branches. */
  readonly depth = input(0)
  readonly store = inject(BuilderStore)
  readonly actionTypes = ACTION_DEFINITIONS
  readonly branches = [
    { key: 'onSuccess' as const },
    { key: 'onError' as const },
  ]
  readonly severities = [
    { value: 'info', label: 'Info', icon: 'info' },
    { value: 'success', label: 'Success', icon: 'check_circle' },
    { value: 'warning', label: 'Warning', icon: 'warning' },
    { value: 'error', label: 'Error', icon: 'error' },
  ]
  readonly positions = [
    { value: 'bottom-center', label: 'Bottom' },
    { value: 'bottom-end', label: 'Bottom right' },
    { value: 'top-center', label: 'Top' },
    { value: 'top-end', label: 'Top right' },
  ]
  readonly definition = computed(() => actionDefinition(this.action().type))
  readonly runtime = inject(SiteRuntime)
  readonly paths = computed<PathOption[]>(() => {
    const extra: PathOption[] = []
    const owner = this.pageLevel()
    if (typeof owner === 'string') {
      const workflow = this.store
        .project()
        .workflows?.find((item) => item.id === owner)
      for (const param of workflow?.params ?? [])
        extra.push({
          path: `input.${param.name}`,
          label: `input ${param.name}`,
          group: 'Input',
        })
      for (const name of savedNames(workflow?.steps ?? []))
        extra.push({
          path: `steps.${name}`,
          label: `result of “${name}”`,
          group: 'Steps',
        })
    }
    if (this.depth() > 0) {
      extra.push(
        {
          path: 'response',
          label: 'previous step’s result',
          group: 'Response',
        },
        { path: 'error.message', label: 'error message', group: 'Error' },
        { path: 'row', label: 'table row (row actions)', group: 'Row' },
      )
    }
    return [
      ...extra,
      ...scopePaths(
        this.store.project(),
        this.store.page(),
        (id) => Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
        this.store.selected(),
      ),
    ]
  })
  readonly fieldNames = computed(() => [
    ...new Set(
      this.store
        .layers()
        .map((layer) => layer.block)
        .filter((block) => isFormField(block.type))
        .map(fieldName),
    ),
  ])
  readonly mutations = computed(() =>
    this.store
      .project()
      .dataSources.filter(
        (source) => source.kind === 'rest' && source.mode === 'mutation',
      ),
  )
  readonly workflows = computed(() => this.store.project().workflows ?? [])
  readonly selectedWorkflow = computed(() =>
    this.workflows().find((item) => item.id === this.action().target),
  )
  readonly collections = computed(() =>
    this.store
      .project()
      .dataSources.filter((source) => source.kind === 'collection'),
  )

  update(patch: Partial<Action>): void {
    this.store.updateAction(this.action().id, patch, this.pageLevel())
  }

  saveAs(value: string): void {
    this.option('saveAs', value.replace(/[^\w]/g, '').slice(0, 40))
  }

  option(key: string, value: string): void {
    this.store.setActionOption(this.action().id, key, value, this.pageLevel())
  }
}

/** Names saved with "Save result as" anywhere in a list of steps. */
export function savedNames(
  steps: readonly Action[],
  out = new Set<string>(),
): Set<string> {
  for (const step of steps) {
    if (step.options?.['saveAs']) out.add(step.options['saveAs'])
    for (const nested of [
      step.onSuccess,
      step.onError,
      ...(step.branches ?? []),
    ])
      if (nested) savedNames(nested, out)
  }
  return out
}
