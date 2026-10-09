import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { Block, Scope, blockLayoutClasses, interpolate } from '../../core/model'
import { BlockList } from './block-list'

/** Renders a Dialog block's children inside a Material dialog. */
@Component({
  selector: 'wb-site-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, BlockList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.block.props['presentation'] === 'bottom') {
      <span class="wb-sheet-handle" aria-hidden="true"></span>
    }
    <div class="ui-row ui-align-center ui-gap-2 ui-divider-bottom">
      <h2 mat-dialog-title class="ui-grow">
        {{ title() }}
        @if (subtitle()) {
          <span
            class="wb-dialog-subtitle mat-font-body-md mat-text-on-surface-variant"
            >{{ subtitle() }}</span
          >
        }
      </h2>
      @if (data.block.props['closeButton']) {
        <button
          matIconButton
          mat-dialog-close
          aria-label="Close dialog"
          class="ui-shrink-0 wb-dialog-close"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
    <mat-dialog-content>
      <wb-block-list
        [blocks]="data.block.children"
        [parentId]="data.block.id + '-dialog'"
        parentType="dialog"
        [layoutClass]="layout()"
        [scope]="data.scope"
        [readonly]="true"
      />
    </mat-dialog-content>
  `,
})
export class SiteDialog {
  readonly data = inject<{ block: Block; scope: Scope }>(MAT_DIALOG_DATA)
  readonly title = computed(() =>
    interpolate(this.data.block.props['title'], this.data.scope),
  )
  readonly subtitle = computed(() =>
    interpolate(this.data.block.props['subtitle'], this.data.scope),
  )
  readonly layout = computed(
    () => blockLayoutClasses(this.data.block) + ' ui-py-2',
  )
}
