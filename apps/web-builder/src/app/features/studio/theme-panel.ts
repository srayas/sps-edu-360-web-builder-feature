import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatIconModule } from '@angular/material/icon'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatDividerModule } from '@angular/material/divider'
import {
  FONTS,
  PALETTES,
  Palette,
  RADII,
  ThemeSettings,
  fontClassSlug,
} from '../../core/model'
import { BuilderStore } from './builder-store'

/** Project theme (Material palettes, type, density, shape, color scheme) and the app shell. */
@Component({
  selector: 'wb-theme-panel',
  imports: [
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let theme = store.project().theme;
    @let shell = store.project().shell;
    <div class="ui-column ui-gap-4 ui-p-3">
      <div class="ui-column ui-gap-1">
        <h2 class="mat-font-title-md ui-m-0">Theme</h2>
        <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
          Every block uses these Material 3 tokens unless you override it in
          Design.
        </p>
      </div>
      <section class="ui-column ui-gap-2">
        <h3 class="mat-font-label-lg ui-m-0">Presets</h3>
        <div class="wb-presets" role="radiogroup" aria-label="Theme preset">
          @for (preset of presets; track preset.name) {
            <button
              type="button"
              role="radio"
              class="wb-preset"
              [class.wb-preset-active]="isPreset(preset)"
              [attr.aria-checked]="isPreset(preset)"
              (click)="applyPreset(preset)"
            >
              <span class="wb-preset-colors">
                <span [class]="'wb-swatch-' + preset.primary"></span>
                <span [class]="'wb-swatch-' + preset.tertiary"></span>
              </span>
              <span class="mat-font-label-md">{{ preset.name }}</span>
              <span
                class="mat-font-body-sm mat-text-on-surface-variant"
                [class]="'wb-font-sample-' + slug(preset.headingFont)"
                >{{ preset.headingFont }}</span
              >
            </button>
          }
        </div>
      </section>
      <section class="ui-column ui-gap-2">
        <h3 class="mat-font-label-lg ui-m-0">Primary color</h3>
        <div class="wb-swatches" role="radiogroup" aria-label="Primary color">
          @for (palette of palettes; track palette) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="theme.primary === palette"
              [attr.aria-label]="label(palette)"
              [matTooltip]="label(palette)"
              [class]="'wb-swatch wb-swatch-' + palette"
              [class.wb-swatch-active]="theme.primary === palette"
              (click)="store.updateTheme({ primary: palette })"
            >
              @if (theme.primary === palette) {
                <mat-icon>check</mat-icon>
              }
            </button>
          }
        </div>
      </section>
      <section class="ui-column ui-gap-2">
        <h3 class="mat-font-label-lg ui-m-0">Accent (tertiary)</h3>
        <div class="wb-swatches" role="radiogroup" aria-label="Accent color">
          @for (palette of palettes; track palette) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="theme.tertiary === palette"
              [attr.aria-label]="label(palette)"
              [matTooltip]="label(palette)"
              [class]="'wb-swatch wb-swatch-' + palette"
              [class.wb-swatch-active]="theme.tertiary === palette"
              (click)="store.updateTheme({ tertiary: palette })"
            >
              @if (theme.tertiary === palette) {
                <mat-icon>check</mat-icon>
              }
            </button>
          }
        </div>
      </section>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Heading font</mat-label>
        <mat-select
          [value]="theme.headingFont"
          (selectionChange)="store.updateTheme({ headingFont: $event.value })"
        >
          @for (font of fonts; track font) {
            <mat-option [value]="font"
              ><span [class]="'wb-font-sample-' + slug(font)">{{
                font
              }}</span></mat-option
            >
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Body font</mat-label>
        <mat-select
          [value]="theme.bodyFont"
          (selectionChange)="store.updateTheme({ bodyFont: $event.value })"
        >
          @for (font of fonts; track font) {
            <mat-option [value]="font"
              ><span [class]="'wb-font-sample-' + slug(font)">{{
                font
              }}</span></mat-option
            >
          }
        </mat-select>
      </mat-form-field>
      <section class="ui-column ui-gap-2">
        <h3 class="mat-font-label-lg ui-m-0">Corners</h3>
        <mat-button-toggle-group
          [value]="theme.radius"
          (change)="store.updateTheme({ radius: $event.value })"
          aria-label="Corner style"
          class="ui-fill"
          hideSingleSelectionIndicator
        >
          @for (radius of radii; track radius) {
            <mat-button-toggle [value]="radius">{{ radius }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </section>
      <section class="ui-column ui-gap-2">
        <h3 class="mat-font-label-lg ui-m-0">Density</h3>
        <mat-button-toggle-group
          [value]="theme.density"
          (change)="store.updateTheme({ density: $event.value })"
          aria-label="Density"
          class="ui-fill"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle [value]="0">Default</mat-button-toggle>
          <mat-button-toggle [value]="-1">-1</mat-button-toggle>
          <mat-button-toggle [value]="-2">-2</mat-button-toggle>
          <mat-button-toggle [value]="-3">-3</mat-button-toggle>
          <mat-button-toggle [value]="-4">Compact</mat-button-toggle>
        </mat-button-toggle-group>
      </section>
      <section class="ui-column ui-gap-2">
        <h3 class="mat-font-label-lg ui-m-0">Color scheme</h3>
        <mat-button-toggle-group
          [value]="theme.mode"
          (change)="store.updateTheme({ mode: $event.value })"
          aria-label="Color scheme"
          class="ui-fill"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle value="light"
            ><mat-icon>light_mode</mat-icon> Light</mat-button-toggle
          >
          <mat-button-toggle value="dark"
            ><mat-icon>dark_mode</mat-icon> Dark</mat-button-toggle
          >
          <mat-button-toggle value="system"
            ><mat-icon>contrast</mat-icon> Auto</mat-button-toggle
          >
        </mat-button-toggle-group>
      </section>

      <mat-divider />
      <div class="ui-column ui-gap-1">
        <h2 class="mat-font-title-md ui-m-0">App shell</h2>
        <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
          A Material frame around every page with navigation to the pages marked
          “Show in navigation”.
        </p>
      </div>
      <mat-slide-toggle
        [checked]="shell.enabled"
        (change)="store.updateShell({ enabled: $event.checked })"
        >Use app shell</mat-slide-toggle
      >
      @if (shell.enabled) {
        <mat-button-toggle-group
          [value]="shell.layout"
          (change)="store.updateShell({ layout: $event.value })"
          aria-label="Navigation layout"
          class="ui-fill"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle value="top"
            ><mat-icon>web_asset</mat-icon> Top bar</mat-button-toggle
          >
          <mat-button-toggle value="side"
            ><mat-icon>view_sidebar</mat-icon> Side nav</mat-button-toggle
          >
        </mat-button-toggle-group>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Title</mat-label>
          <input
            matInput
            [value]="shell.title"
            [placeholder]="store.project().name"
            (input)="store.updateShell({ title: $any($event.target).value })"
          />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Logo icon</mat-label>
          <mat-icon matPrefix>{{ shell.icon }}</mat-icon>
          <input
            matInput
            [value]="shell.icon"
            (input)="store.updateShell({ icon: $any($event.target).value })"
          />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Footer text</mat-label>
          <input
            matInput
            [value]="shell.footer"
            (input)="store.updateShell({ footer: $any($event.target).value })"
          />
        </mat-form-field>
      }
    </div>
  `,
})
export class ThemePanel {
  readonly store = inject(BuilderStore)
  readonly palettes = PALETTES
  readonly fonts = FONTS
  readonly radii = RADII
  /** Curated modern themes: palette pair, typefaces and corner style in one click. */
  readonly presets: (Pick<
    ThemeSettings,
    'primary' | 'tertiary' | 'headingFont' | 'bodyFont' | 'radius'
  > & { name: string })[] = [
    {
      name: 'Iris',
      primary: 'iris',
      tertiary: 'ruby',
      headingFont: 'Geist',
      bodyFont: 'Geist',
      radius: 'medium',
    },
    {
      name: 'Graphite',
      primary: 'graphite',
      tertiary: 'ocean',
      headingFont: 'Geist',
      bodyFont: 'Geist',
      radius: 'small',
    },
    {
      name: 'Emerald',
      primary: 'emerald',
      tertiary: 'ocean',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      radius: 'medium',
    },
    {
      name: 'Ocean',
      primary: 'ocean',
      tertiary: 'emerald',
      headingFont: 'Montserrat',
      bodyFont: 'Inter',
      radius: 'large',
    },
    {
      name: 'Sunset',
      primary: 'sunset',
      tertiary: 'ruby',
      headingFont: 'Poppins',
      bodyFont: 'Inter',
      radius: 'large',
    },
    {
      name: 'Editorial',
      primary: 'ruby',
      tertiary: 'graphite',
      headingFont: 'Playfair Display',
      bodyFont: 'Geist',
      radius: 'small',
    },
  ]

  isPreset(preset: (typeof this.presets)[number]): boolean {
    const theme = this.store.project().theme
    return (
      theme.primary === preset.primary &&
      theme.tertiary === preset.tertiary &&
      theme.headingFont === preset.headingFont &&
      theme.bodyFont === preset.bodyFont &&
      theme.radius === preset.radius
    )
  }

  applyPreset(preset: (typeof this.presets)[number]): void {
    const { name: _name, ...settings } = preset
    this.store.updateTheme(settings)
  }
  label(palette: Palette): string {
    return palette
      .replace('-', ' ')
      .replace(/^./, (letter) => letter.toUpperCase())
  }
  slug(font: string): string {
    return fontClassSlug(font)
  }
}
