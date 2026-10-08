import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import { THEME_ACCENTS, ThemeMode, ThemeService } from './theme.service'

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
      <div
        class="ui-px-4 ui-pt-2 ui-pb-1 mat-font-label-md mat-text-on-surface-variant"
      >
        Appearance
      </div>
      @for (option of options; track option.mode) {
        <button
          mat-menu-item
          (click)="theme.mode.set(option.mode)"
          [class.ui-menu-selected]="theme.mode() === option.mode"
          [attr.aria-checked]="theme.mode() === option.mode"
          role="menuitemradio"
        >
          <mat-icon>{{ option.icon }}</mat-icon>
          <span>{{ option.label }}</span>
        </button>
      }
      <div
        class="ui-px-4 ui-pt-4 ui-pb-2 mat-font-label-md mat-text-on-surface-variant"
      >
        Accent
      </div>
      <div
        class="ui-row ui-gap-3 ui-px-4 ui-pt-1 ui-pb-3"
        role="radiogroup"
        aria-label="Accent colour"
      >
        @for (accent of accents; track accent.id) {
          <button
            type="button"
            role="radio"
            [class]="'ui-accent-dot ui-accent-swatch-' + accent.id"
            [class.ui-accent-dot-active]="theme.accent() === accent.id"
            [attr.aria-checked]="theme.accent() === accent.id"
            [attr.aria-label]="accent.label"
            [matTooltip]="accent.label"
            (click)="$event.stopPropagation(); theme.accent.set(accent.id)"
          ></button>
        }
      </div>
    </mat-menu>
  `,
})
export class ThemeSwitcher {
  readonly theme = inject(ThemeService)
  readonly accents = THEME_ACCENTS
  readonly options: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: 'light_mode' },
    { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
    { mode: 'system', label: 'System', icon: 'contrast' },
  ]
}
