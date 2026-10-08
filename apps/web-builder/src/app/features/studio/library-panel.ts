import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core'
import { DragDropModule } from '@angular/cdk/drag-drop'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatExpansionModule } from '@angular/material/expansion'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import {
  BLOCK_DEFINITIONS,
  BLOCK_GROUPS,
  TEMPLATES,
  Template,
} from '../../core/model'
import { DragData, EDITOR_BRIDGE } from '../../core/runtime/editor-bridge'
import { BuilderStore } from './builder-store'

/** Palette of blocks and section templates; items can be clicked or dragged onto the canvas. */
@Component({
  selector: 'wb-library-panel',
  imports: [
    DragDropModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column ui-gap-2 ui-p-3">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Search blocks and sections</mat-label>
        <input
          #searchInput
          matInput
          type="search"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
        />
      </mat-form-field>
      <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
        Drag onto the canvas, or click to add
        {{ store.selected() ? 'next to the selection' : 'to the page' }}.
      </p>
    </div>
    <div
      cdkDropList
      id="wb-palette"
      [cdkDropListConnectedTo]="bridge.connectedLists()"
      cdkDropListSortingDisabled
      [cdkDropListEnterPredicate]="never"
    >
      <mat-accordion multi displayMode="flat" class="wb-palette">
        @for (group of groups(); track group.name) {
          <mat-expansion-panel [expanded]="true">
            <mat-expansion-panel-header
              ><mat-panel-title>{{ group.name }}</mat-panel-title
              ><mat-panel-description>{{
                group.items.length
              }}</mat-panel-description></mat-expansion-panel-header
            >
            <div class="wb-tile-grid">
              @for (item of group.items; track item.type) {
                <button
                  matButton
                  type="button"
                  class="wb-tile"
                  cdkDrag
                  [cdkDragData]="newBlock(item.type)"
                  (click)="store.addSmart(item.type)"
                  [matTooltip]="item.description"
                  matTooltipPosition="right"
                  [attr.aria-label]="'Add ' + item.label"
                >
                  <span class="ui-column ui-align-center ui-gap-1">
                    <mat-icon>{{ item.icon }}</mat-icon>
                    <span class="mat-font-label-sm">{{ item.label }}</span>
                  </span>
                  <div
                    *cdkDragPreview
                    class="wb-drag-preview mat-bg-primary-container mat-text-on-primary-container mat-shadow-3 mat-corner-md"
                  >
                    <mat-icon>{{ item.icon }}</mat-icon
                    >{{ item.label }}
                  </div>
                  <div *cdkDragPlaceholder class="wb-tile-placeholder"></div>
                </button>
              }
            </div>
          </mat-expansion-panel>
        }
        @if (sections().length) {
          <mat-expansion-panel [expanded]="true">
            <mat-expansion-panel-header
              ><mat-panel-title>Sections</mat-panel-title
              ><mat-panel-description>{{
                sections().length
              }}</mat-panel-description></mat-expansion-panel-header
            >
            <div class="ui-column ui-gap-1">
              @for (template of sections(); track template.id) {
                <button
                  matButton
                  type="button"
                  class="wb-template"
                  cdkDrag
                  [cdkDragData]="templateData(template)"
                  (click)="insert(template)"
                  [attr.aria-label]="'Insert ' + template.name"
                >
                  <mat-icon>{{ template.icon }}</mat-icon>
                  <span class="ui-column ui-align-start ui-min-0">
                    <span class="mat-font-title-sm">{{ template.name }}</span>
                    <span
                      class="mat-font-body-sm mat-text-on-surface-variant ui-truncate"
                      >{{ template.description }}</span
                    >
                  </span>
                  <div
                    *cdkDragPreview
                    class="wb-drag-preview wb-bg-tertiary-container mat-shadow-3 mat-corner-md"
                  >
                    <mat-icon>{{ template.icon }}</mat-icon
                    >{{ template.name }}
                  </div>
                  <div *cdkDragPlaceholder class="wb-tile-placeholder"></div>
                </button>
              }
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>
      @if (!groups().length && !sections().length) {
        <p class="mat-font-body-md mat-text-on-surface-variant ui-p-4">
          Nothing matches “{{ search() }}”.
        </p>
      }
    </div>
  `,
})
export class LibraryPanel {
  readonly store = inject(BuilderStore)
  readonly bridge = inject(EDITOR_BRIDGE)
  readonly search = signal('')
  private readonly searchInput =
    viewChild<ElementRef<HTMLInputElement>>('searchInput')

  readonly groups = computed(() => {
    const term = this.search().trim().toLowerCase()
    return BLOCK_GROUPS.map((name) => ({
      name,
      items: BLOCK_DEFINITIONS.filter(
        (item) =>
          item.group === name &&
          !item.internal &&
          (!term ||
            `${item.label} ${item.description} ${item.type}`
              .toLowerCase()
              .includes(term)),
      ),
    })).filter((group) => group.items.length)
  })
  readonly sections = computed(() => {
    const term = this.search().trim().toLowerCase()
    return TEMPLATES.filter(
      (template) =>
        template.kind === 'section' &&
        (!term ||
          `${template.name} ${template.description}`
            .toLowerCase()
            .includes(term)),
    )
  })

  readonly never = () => false
  newBlock(type: string): DragData {
    return { kind: 'new', type }
  }
  templateData(template: Template): DragData {
    return { kind: 'template', templateId: template.id }
  }

  insert(template: Template): void {
    const page = this.store.page()
    const selected = this.store.selected()
    const top = selected ? this.store.selectedPath()[0] : undefined
    const index = top
      ? page.blocks.findIndex((block) => block.id === top.id) + 1
      : undefined
    this.store.insertTemplate(template, 'root', index)
  }

  focusSearch(): void {
    this.searchInput()?.nativeElement.focus()
  }
}
