import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatMenuModule } from '@angular/material/menu'
import { EmptyState } from '@spsedu360/shared-ui'
import { ACTION_DEFINITIONS, Workflow } from '../../../core/model'
import { SiteRuntime } from '../../../core/runtime/site-runtime'
import { ActionEditor, savedNames } from '../action-editor'
import { BuilderStore } from '../builder-store'
import { ExprEditor } from './expr-editor'
import { ParamsEditor } from './params-editor'
import { PathOption, scopePaths } from './scope-paths'

/** Reusable multi-step executions with inputs, saved step results, parallel branches and an output. */
@Component({
  selector: 'wb-workflows-panel',
  imports: [
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    EmptyState,
    ActionEditor,
    ExprEditor,
    ParamsEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column ui-gap-3">
      <div class="ui-column ui-gap-2">
        <span class="mat-font-body-sm mat-text-on-surface-variant"
          >Steps that run in order (or in parallel), pass results along as
          <code>{{ '{{steps.name}}' }}</code> and return an output. Start one
          from any button, form, row action or page load with
          <strong>Run workflow</strong>.</span
        >
        <button
          matButton="tonal"
          type="button"
          class="ui-self-start"
          (click)="store.addWorkflow()"
        >
          <mat-icon>add</mat-icon>Workflow
        </button>
      </div>
      <mat-accordion displayMode="flat" multi>
        @for (workflow of workflows(); track workflow.id; let last = $last) {
          <mat-expansion-panel [expanded]="last">
            <mat-expansion-panel-header>
              <mat-panel-title class="ui-gap-2"
                ><mat-icon class="ui-icon-sm">account_tree</mat-icon
                >{{ workflow.name }}</mat-panel-title
              >
              <mat-panel-description
                >{{ workflow.steps.length }}
                {{
                  workflow.steps.length === 1 ? 'step' : 'steps'
                }}</mat-panel-description
              >
            </mat-expansion-panel-header>
            <div class="ui-column ui-gap-3">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Name</mat-label>
                <input
                  matInput
                  [value]="workflow.name"
                  (change)="rename(workflow, $any($event.target).value)"
                />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Description</mat-label>
                <input
                  matInput
                  [value]="workflow.description ?? ''"
                  (input)="
                    store.updateWorkflow(workflow.id, {
                      description: $any($event.target).value || undefined,
                    })
                  "
                />
              </mat-form-field>
              <span class="mat-font-label-lg"
                >Inputs
                <span class="mat-font-body-sm mat-text-on-surface-variant"
                  >— read as {{ '{{input.name}}' }}</span
                ></span
              >
              <wb-params-editor
                [params]="workflow.params"
                (paramsChange)="
                  store.updateWorkflow(workflow.id, { params: $event })
                "
              />
              <div class="ui-row ui-align-center">
                <span class="mat-font-label-lg ui-grow">Steps</span>
                <button
                  matButton
                  type="button"
                  [matMenuTriggerFor]="stepMenu"
                  [matMenuTriggerData]="{ id: workflow.id }"
                >
                  <mat-icon>add</mat-icon>Step
                </button>
              </div>
              @for (
                step of workflow.steps;
                track step.id;
                let i = $index;
                let lastStep = $last
              ) {
                <wb-action-editor
                  [action]="step"
                  [index]="i"
                  [last]="lastStep"
                  [pageLevel]="workflow.id"
                />
              } @empty {
                <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
                  No steps yet — e.g. Compute value → Run in parallel (two API
                  calls) → Show notification.
                </p>
              }
              <span class="mat-font-label-lg">Output</span>
              @if (workflow.output) {
                <wb-expr-editor
                  [expr]="workflow.output"
                  purpose="value"
                  [paths]="outputPaths(workflow)"
                  [valuePaths]="outputPaths(workflow)"
                  [scope]="runtime.scope()"
                  (exprChange)="
                    store.updateWorkflow(workflow.id, { output: $event })
                  "
                />
              } @else {
                <button
                  matButton
                  type="button"
                  class="ui-self-start"
                  (click)="
                    store.updateWorkflow(workflow.id, {
                      output: { kind: 'template', text: '' },
                    })
                  "
                >
                  <mat-icon>output</mat-icon>Return a value…
                </button>
                <span class="mat-font-body-sm mat-text-on-surface-variant"
                  >Without an output, callers get the last step’s result as
                  {{ '{{response}}' }}.</span
                >
              }
              <button
                matButton
                type="button"
                class="ui-self-end"
                (click)="store.removeWorkflow(workflow.id)"
              >
                <mat-icon>delete_outline</mat-icon>Delete workflow
              </button>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>
      @if (!workflows().length) {
        <ui-empty-state
          icon="account_tree"
          heading="No workflows yet"
          message="Example: “Checkout” computes the order, saves it and notifies the customer in parallel, then returns the order id."
        />
      }
      <mat-menu #stepMenu="matMenu">
        <ng-template matMenuContent let-id="id">
          @for (type of actionTypes; track type.type) {
            <button
              mat-menu-item
              (click)="store.addWorkflowStep(id, type.type)"
            >
              <mat-icon>{{ type.icon }}</mat-icon
              ><span>{{ type.label }}</span>
            </button>
          }
        </ng-template>
      </mat-menu>
    </div>
  `,
})
export class WorkflowsPanel {
  readonly store = inject(BuilderStore)
  readonly runtime = inject(SiteRuntime)
  readonly actionTypes = ACTION_DEFINITIONS
  readonly workflows = computed(() => this.store.project().workflows ?? [])

  outputPaths(workflow: Workflow): PathOption[] {
    return [
      ...workflow.params.map((param) => ({
        path: `input.${param.name}`,
        label: `input ${param.name}`,
        group: 'Input' as const,
      })),
      ...[...savedNames(workflow.steps)].map((name) => ({
        path: `steps.${name}`,
        label: `result of “${name}”`,
        group: 'Steps' as const,
      })),
      {
        path: 'response',
        label: 'last step’s result',
        group: 'Response' as const,
      },
      ...scopePaths(this.store.project(), this.store.page(), (id) =>
        Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
      ),
    ]
  }

  rename(workflow: Workflow, name: string): void {
    const clean = name.trim()
    if (
      clean &&
      !this.workflows().some(
        (other) => other.id !== workflow.id && other.name === clean,
      )
    )
      this.store.updateWorkflow(workflow.id, { name: clean })
  }
}
