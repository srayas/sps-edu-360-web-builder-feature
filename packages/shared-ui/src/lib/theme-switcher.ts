import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import { ThemeMode, ThemeService } from './theme.service'

@Component({
  selector: 'ui-theme-switcher',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="menu"
      matTooltip="Appearance"
      aria-label="Change appearance"
    >
      <mat-icon>{{ theme.isDark() ? 'dark_mode' : 'light_mode' }}</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      @for (option of options; track option.mode) {
        <button
          mat-menu-item
          (click)="theme.mode.set(option.mode)"
          [attr.aria-checked]="theme.mode() === option.mode"
          role="menuitemradio"
        >
          <mat-icon>{{ option.icon }}</mat-icon>
          <span>{{ option.label }}</span>
          @if (theme.mode() === option.mode) {
            <mat-icon class="mat-text-primary">check</mat-icon>
          }
        </button>
      }
    </mat-menu>
  `,
})
export class ThemeSwitcher {
  readonly theme = inject(ThemeService)
  readonly options: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: 'light_mode' },
    { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
    { mode: 'system', label: 'System', icon: 'contrast' },
  ]
}
