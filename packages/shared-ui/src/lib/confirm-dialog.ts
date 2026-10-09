import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  inject,
} from '@angular/core'
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { firstValueFrom } from 'rxjs'

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  /** Extra overlay panel classes (e.g. a theme scope). */
  panelClass?: string[]
}

@Component({
  selector: 'ui-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content
      ><p class="ui-m-0">{{ data.message }}</p></mat-dialog-content
    >
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">
        {{ data.cancelText || 'Cancel' }}
      </button>
      <button
        mat-flat-button
        [class.mat-bg-error]="data.destructive"
        [class.mat-text-on-error]="data.destructive"
        [mat-dialog-close]="true"
        cdkFocusInitial
      >
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA)
}

/** Promise-based Material replacement for `window.confirm`. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog)

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmOptions, boolean>(
      ConfirmDialog,
      {
        data: options,
        panelClass: options.panelClass,
        width: '420px',
        maxWidth: 'calc(100vw - 32px)',
      },
    )
    return (await firstValueFrom(ref.afterClosed())) === true
  }
}
