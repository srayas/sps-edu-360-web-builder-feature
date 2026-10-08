import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { EmptyState } from '@spsedu360/shared-ui'
import { Block, definition, hasOverrides } from '../../core/model'
import { BuilderStore } from './builder-store'

/** Outline of the page's block tree. */
@Component({
  selector: 'wb-layers-panel',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column ui-p-2" role="tree" aria-label="Page layers">
      @for (layer of store.layers(); track layer.block.id) {
        <button
          type="button"
          role="treeitem"
          [attr.aria-level]="layer.depth + 1"
          [attr.aria-selected]="store.selectedId() === layer.block.id"
          [class]="
            'wb-layer ui-row ui-align-center ui-gap-2 wb-indent-' +
            (layer.depth > 10 ? 10 : layer.depth)
          "
          [class.wb-layer-active]="store.selectedId() === layer.block.id"
          (click)="store.selectedId.set(layer.block.id)"
        >
          <mat-icon class="ui-icon-sm ui-shrink-0">{{
            icon(layer.block)
          }}</mat-icon>
          <span class="mat-font-body-md ui-truncate ui-grow">{{
            layer.block.name
          }}</span>
          @if (layer.block.actions.length) {
            <mat-icon
              class="ui-icon-sm mat-text-on-surface-variant"
              matTooltip="Has actions"
              >bolt</mat-icon
            >
          }
          @if (
            layer.block.visibility.variable ||
            layer.block.visibility.hideOn.length
          ) {
            <mat-icon
              class="ui-icon-sm mat-text-on-surface-variant"
              matTooltip="Conditional visibility"
              >visibility_off</mat-icon
            >
          }
          @if (overrides(layer.block)) {
            <span
              class="wb-dot mat-bg-primary"
              matTooltip="Style overrides"
            ></span>
          }
        </button>
      } @empty {
        <ui-empty-state
          icon="layers"
          heading="No blocks yet"
          message="Add blocks from the Add panel or drop a section template on the canvas."
        />
      }
    </div>
  `,
})
export class LayersPanel {
  readonly store = inject(BuilderStore)
  icon(block: Block): string {
    return definition(block.type)?.icon ?? 'widgets'
  }
  overrides(block: Block): boolean {
    return hasOverrides(block)
  }
}
