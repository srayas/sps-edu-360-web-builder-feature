import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import type { NotificationSeverity } from '../model'

export interface NotificationData {
  severity: NotificationSeverity
  title: string
  message: string
  actionLabel: string
}

const ICONS: Record<NotificationSeverity, string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
}

/** Toast notification shown by "Show notification" actions and by failed steps. */
@Component({
  selector: 'wb-notification-toast',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-toast-host' },
  template: `
    <div
      class="wb-toast-body"
      [attr.role]="
        data.severity === 'error' || data.severity === 'warning'
          ? 'alert'
          : 'status'
      "
    >
      <mat-icon [class]="'wb-toast-icon wb-toast-icon-' + data.severity">{{
        icon
      }}</mat-icon>
      <div class="ui-column ui-gap-1 ui-grow ui-min-0">
        @if (data.title) {
          <span class="mat-font-title-sm">{{ data.title }}</span>
        }
        @if (data.message) {
          <span class="mat-font-body-md wb-toast-message">{{
            data.message
          }}</span>
        }
      </div>
      @if (data.actionLabel) {
        <button matButton type="button" (click)="ref.dismissWithAction()">
          {{ data.actionLabel }}
        </button>
      }
      <button
        matIconButton
        type="button"
        class="wb-icon-button-sm"
        aria-label="Dismiss notification"
        (click)="ref.dismiss()"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
})
export class NotificationToast {
  readonly data = inject<NotificationData>(MAT_SNACK_BAR_DATA)
  readonly ref = inject<MatSnackBarRef<NotificationToast>>(MatSnackBarRef)
  readonly icon = ICONS[this.data.severity] ?? 'info'
}
