import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import {
  Action,
  actionDefinition,
  fieldName,
  isFormField,
} from '../../core/model'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { ExprEditor } from './logic/expr-editor'
import { scopePaths } from './logic/scope-paths'
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
    ExprEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = action();
    @let def = definition();
    <div
      class="wb-action ui-column ui-gap-2 ui-p-3 mat-bg-surface-container-low mat-corner-md"
    >
      <div class="ui-row ui-align-center ui-gap-2">
        <mat-icon class="mat-text-primary ui-icon-sm">{{ def?.icon }}</mat-icon>
        <span class="mat-font-title-sm ui-grow"
          >{{ index() + 1 }}. {{ def?.label }}</span
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
  readonly pageLevel = input(false)
  readonly store = inject(BuilderStore)
  readonly definition = computed(() => actionDefinition(this.action().type))
  readonly runtime = inject(SiteRuntime)
  readonly paths = computed(() =>
    scopePaths(
      this.store.project(),
      this.store.page(),
      (id) => Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
      this.store.selected(),
    ),
  )
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
  readonly collections = computed(() =>
    this.store
      .project()
      .dataSources.filter((source) => source.kind === 'collection'),
  )

  update(patch: Partial<Action>): void {
    this.store.updateAction(this.action().id, patch, this.pageLevel())
  }
}
