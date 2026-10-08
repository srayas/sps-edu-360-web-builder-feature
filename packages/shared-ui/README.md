# @spsedu360/shared-ui

Angular Material 3 theme, layout system and application shell shared by spsEdu360 Angular apps.

## Theme

```scss
@use '@angular/material' as mat;
@use '@spsedu360/shared-ui/src/theme' as ui;

@include ui.all((
  primary: mat.$azure-palette,
  tertiary: mat.$violet-palette,
  font: ('Public Sans', Roboto, sans-serif),
  density: 0,
));
```

`ui.all` emits:

* the Material system tokens (`mat.theme`) with light/dark switching through `color-scheme` (the theme switcher sets `light-theme` or `dark-theme` on `<html>`),
* Material's system utility classes: `mat-bg-*`, `mat-text-*`, `mat-font-*`, `mat-corner-*`, `mat-shadow-*`, `mat-border*`,
* the `ui-*` layout classes in `src/theme/_layout.scss` (flex, grid, gap, padding, alignment, widths, truncation, responsive visibility),
* the shell classes.

Components in this workspace do not ship their own CSS or inline styles; they compose these classes and Angular Material components.

## Components

| Selector | Purpose |
| --- | --- |
| `ui-app-shell` | Side navigation, top bar and content area (configure through `ShellService`) |
| `ui-nav-bar` | Top bar with menu toggle, breadcrumbs, search and theme switcher |
| `ui-breadcrumbs` | Breadcrumb trail |
| `ui-search-bar` | Material search field (`[(value)]`) |
| `ui-theme-switcher` | Light / dark / system menu (`ThemeService`) |
| `ui-team-switcher` | Team menu |
| `ui-page-header` | Page title, description and actions |
| `ui-empty-state` | Icon, heading, message and actions |
| `ConfirmService` | Promise-based Material confirm dialog |
