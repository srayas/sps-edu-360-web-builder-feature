import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatSelectModule } from '@angular/material/select'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatExpansionModule } from '@angular/material/expansion'
import {
  Block,
  BlockLogic,
  Expr,
  definition,
  exprPaths,
  fieldName,
  findValueCycles,
  flatten,
  isContainer,
  isFormField,
} from '../../../core/model'
import { SiteRuntime } from '../../../core/runtime/site-runtime'
import { BuilderStore } from '../builder-store'
import { ExprEditor, ExprPurpose } from './expr-editor'
import { scopePaths } from './scope-paths'

interface Binding {
  key: Exclude<keyof BlockLogic, 'props'>
  title: string
  description: string
  purpose: ExprPurpose
  icon: string
}

const CHOICE_FIELDS = new Set([
  'select',
  'radio',
  'toggle-group',
  'autocomplete',
])
const INTERACTIVE = new Set(['button', 'link', 'menu', 'card'])

/** Reactive bindings of the selected block: what it shows, whether it is usable, what it computes. */
@Component({
  selector: 'wb-block-logic-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatExpansionModule,
    ExprEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let b = block();
    <section class="ui-column ui-gap-3">
      <div class="ui-column ui-gap-1">
        <h3 class="mat-font-title-sm ui-m-0">Reactive logic</h3>
        <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
          Make this block react to fields, variables and data. Changes apply
          instantly as people use the page.
        </p>
      </div>
      <mat-accordion multi displayMode="flat">
        @for (binding of bindings(); track binding.key) {
          <mat-expansion-panel [expanded]="!!b.logic[binding.key]">
            <mat-expansion-panel-header>
              <mat-panel-title class="ui-gap-2"
                ><mat-icon class="ui-icon-sm">{{ binding.icon }}</mat-icon
                >{{ binding.title }}</mat-panel-title
              >
              @if (b.logic[binding.key]) {
                <mat-panel-description
                  ><span class="wb-logic-chip">on</span></mat-panel-description
                >
              }
            </mat-expansion-panel-header>
            <p class="mat-font-body-sm mat-text-on-surface-variant ui-mt-0">
              {{ binding.description }}
            </p>
            @if (binding.key === 'value' && cycle(); as loop) {
              <p class="mat-font-body-sm mat-text-error ui-mt-0" role="alert">
                Circular: {{ loop.join(' → ') }}. These values depend on each
                other, so updates stop.
              </p>
            }
            @if (b.logic[binding.key]; as expr) {
              <wb-expr-editor
                [expr]="expr"
                [purpose]="binding.purpose"
                [paths]="paths()"
                [valuePaths]="paths()"
                [scope]="runtime.scope()"
                (exprChange)="store.setLogic(binding.key, $event)"
              />
            } @else {
              <button matButton="tonal" type="button" (click)="start(binding)">
                <mat-icon>add</mat-icon>Add {{ binding.title.toLowerCase() }}
              </button>
            }
          </mat-expansion-panel>
        }
        <mat-expansion-panel [expanded]="bound().length > 0">
          <mat-expansion-panel-header>
            <mat-panel-title class="ui-gap-2"
              ><mat-icon class="ui-icon-sm">link</mat-icon>Property
              bindings</mat-panel-title
            >
            @if (bound().length) {
              <mat-panel-description
                ><span class="wb-logic-chip">{{
                  bound().length
                }}</span></mat-panel-description
              >
            }
          </mat-expansion-panel-header>
          <p class="mat-font-body-sm mat-text-on-surface-variant ui-mt-0">
            Compute any property — text, label, color, image, items — from other
            values.
          </p>
          <div class="ui-column ui-gap-4">
            @for (entry of bound(); track entry.key) {
              <div class="ui-column ui-gap-2">
                <span class="mat-font-label-lg">{{ entry.label }}</span>
                <wb-expr-editor
                  [expr]="entry.expr"
                  purpose="value"
                  [paths]="paths()"
                  [scope]="runtime.scope()"
                  (exprChange)="store.setPropBinding(entry.key, $event)"
                />
              </div>
            }
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Bind a property</mat-label>
              <mat-select
                [value]="''"
                (selectionChange)="bindProp($event.value)"
              >
                @for (prop of unboundProps(); track prop.key) {
                  <mat-option [value]="prop.key">{{ prop.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </mat-expansion-panel>
      </mat-accordion>
    </section>
  `,
})
export class BlockLogicPanel {
  readonly block = input.required<Block>()
  readonly store = inject(BuilderStore)
  readonly runtime = inject(SiteRuntime)
  readonly started = signal<string[]>([])

  readonly paths = computed(() =>
    scopePaths(
      this.store.project(),
      this.store.page(),
      (id) => Object.keys(this.runtime.rowsFor(id)[0] ?? {}),
      this.block(),
    ),
  )

  readonly bindings = computed<Binding[]>(() => {
    const type = this.block().type
    const out: Binding[] = [
      {
        key: 'visible',
        title: 'Show when',
        description:
          'Shown only while these conditions are true. Hidden blocks stay in the studio, dimmed.',
        purpose: 'condition',
        icon: 'visibility',
      },
    ]
    if (isContainer(type) || isFormField(type) || INTERACTIVE.has(type))
      out.push({
        key: 'enabled',
        title: 'Enable when',
        description: isContainer(type)
          ? 'While false, every field and button inside is disabled.'
          : 'While false, people cannot use it.',
        purpose: 'condition',
        icon: 'toggle_on',
      })
    if (isFormField(type)) {
      out.push({
        key: 'required',
        title: 'Require when',
        description: 'Required only while these conditions are true.',
        purpose: 'condition',
        icon: 'emergency',
      })
      out.push({
        key: 'value',
        title: 'Computed value',
        description:
          'Calculated from other values and shown read-only, e.g. a total or a full name.',
        purpose: 'value',
        icon: 'calculate',
      })
    }
    if (CHOICE_FIELDS.has(type))
      out.push({
        key: 'options',
        title: 'Options from',
        description:
          'A list (of text, or of {label, value}) that changes with other values — e.g. cities for the selected country.',
        purpose: 'value',
        icon: 'list',
      })
    return out
  })

  /** A computed-value loop that includes this field, if any (A reads B, B reads A). */
  readonly cycle = computed(() => {
    const block = this.block()
    if (!isFormField(block.type) || !block.logic.value) return null
    const fields = flatten(this.store.page().blocks)
      .filter(({ block: item }) => isFormField(item.type) && item.logic.value)
      .map(({ block: item }) => ({
        name: fieldName(item),
        reads: exprPaths(item.logic.value),
      }))
    const name = fieldName(block)
    return findValueCycles(fields).find((loop) => loop.includes(name)) ?? null
  })

  readonly bound = computed(() => {
    const props = definition(this.block().type)?.props ?? []
    return Object.entries(this.block().logic.props ?? {}).map(
      ([key, expr]) => ({
        key,
        expr,
        label: props.find((prop) => prop.key === key)?.label ?? key,
      }),
    )
  })

  readonly unboundProps = computed(() => {
    const bound = new Set(Object.keys(this.block().logic.props ?? {}))
    return (definition(this.block().type)?.props ?? []).filter(
      (prop) =>
        !bound.has(prop.key) &&
        prop.kind !== 'source' &&
        prop.key !== 'field' &&
        prop.key !== 'bind',
    )
  })

  start(binding: Binding): void {
    const expr: Expr =
      binding.purpose === 'value'
        ? { kind: 'template', text: '' }
        : {
            kind: 'conditions',
            group: {
              combinator: 'and',
              conditions: [
                {
                  field: this.paths()[0]?.path ?? '',
                  operator: 'not_empty',
                  source: 'literal',
                },
              ],
            },
          }
    this.store.setLogic(binding.key, expr)
  }

  bindProp(key: string): void {
    if (!key) return
    const current = this.block().props[key]
    this.store.setPropBinding(key, {
      kind: 'template',
      text: typeof current === 'string' ? current : String(current ?? ''),
    })
  }
}
