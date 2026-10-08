# spsEdu360 Web Builder

An Angular 22 + Angular Material 3 studio for building, previewing and publishing web applications by drag and drop.

```bash
pnpm install                                # from the repository root
pnpm --filter @spsedu360/web-builder dev    # http://localhost:3002
pnpm --filter @spsedu360/web-builder test   # model unit tests
pnpm --filter @spsedu360/web-builder build
```

The Angular 22.2 CLI needs Node.js 22.22.3+ or 24.15+.

## Routes

| Path | What it is |
| --- | --- |
| `/` | Product home |
| `/projects` | Create (blank or from a template), import, duplicate, export and delete apps |
| `/builder/:id` | The studio |
| `/app/:id/:slug?` | The published app, with live actions and data |

## Styling rules

* **One theme.** `src/styles.scss` includes the shared Material 3 theme from `@spsedu360/shared-ui` (`ui.all(...)`).
* **No component CSS and no inline styles.** Components have no `styles`/`styleUrl`, and templates never use `style=""`, `[style.*]` or `ngStyle`. Layout uses the shared `ui-*` classes; color, type, shape and elevation use Material's own `mat-bg-*`, `mat-text-*`, `mat-font-*`, `mat-corner-*` and `mat-shadow-*` system classes; Material components are tuned only through their tokens.
* **Built sites follow the project theme.** `src/styles/_site.scss` turns each project theme setting (primary and accent palette, heading and body font, density, corner style, color scheme) into a class that re-declares Material system tokens on the site root and on overlay panels.
* **User overrides are opt-in and scoped.** The inspector's Design tab writes per-block CSS for all screens, tablet or mobile. Overrides are allow-listed and compiled into one generated stylesheet keyed by the block id (`.wb-el-<id>`), so templates stay free of inline styles. "Reset to theme" removes them.

## Look and feel (2026 refresh)

The theme follows what current product UIs (Linear, Vercel, shadcn/ui, Material 3 Expressive) have converged on, implemented entirely with Angular Material's token APIs in `packages/shared-ui/src/theme`:

* **Neutral first, one vivid accent.** `mat.theme-overrides` replaces M3's tinted neutrals with zinc surfaces (`#fafafa` canvas and white cards in light; `#09090b` canvas with tone-stepped containers in dark). Tonal surfaces are a light wash of the accent.
* **Six accents.** Iris, Graphite, Emerald, Ocean, Sunset and Rose palettes are generated with `ng generate @angular/material:theme-color` (`_palettes.scss`). Light-mode primaries are the most vivid shade that still meets 4.5:1 with white text. Switch them, along with light, dark or system mode, from the appearance menu.
* **Hairlines over shadows.** Panels and cards use 1px outline-variant borders. Elevation is a layered, low-alpha shadow scale used for menus, dialogs and floating panels.
* **Shapes and density.** The corner scale is 6/8/12/16/24px. Controls are rounded squares: 36px buttons, 40px outlined fields and 10px icon buttons. Chips and switches stay pill-shaped.
* **Type.** Geist, with tight tracking on display and headline sizes and semibold titles.
* **Layout.** The page sits in an inset rounded panel beside the navigation, under a translucent (glass) top bar. The studio canvas is a dotted grid.
* **Built sites.** Sites get the same neutral surfaces and modern accents, one-click presets in the Theme panel (Iris, Graphite, Emerald, Ocean, Sunset, Editorial), and the "Accent glow" and "Accent gradient" section surfaces.

## Building blocks

All blocks are declared in `src/app/core/model/registry.ts` (props, defaults, events, placement rules) and rendered with Angular Material in `src/app/features/renderer`.

| Group | Blocks |
| --- | --- |
| Layout | Section, Container, Row, Stack, Grid (per-device columns), Card, Toolbar, Repeater, Tabs › Tab, Accordion › Panel, Stepper › Step |
| Content | Heading, Text, Image, Video, Audio, Embed (sandboxed https), Button (filled, tonal, outlined, elevated, text, icon, FAB, mini FAB, extended FAB), Link, Icon, Bullet list, Quote, Code, Chips, Avatar, Divider, Spacer |
| Navigation | Navigation links (or automatic page links / tab bar), Navigation list, Menu, Breadcrumbs |
| Forms | Form, Text field, Text area, Select, Autocomplete, Checkbox, Radio group, Switch, Slider, Date picker (single or range), Time picker, Button toggle, Tags input, File upload |
| Data | Data table (sort, search, paging), Data list, Statistic, Chart (bar or line), Progress (bar or spinner), Calendar |
| Overlays | Alert, Badge, Dialog |

There are also 12 section templates and 8 page templates (landing, dashboard, product catalogue, task tracker, smart order form, pricing, contact, sign-in). The **smart order form** shows the reactive logic below working together. Templates can bring their own data sources and variables.

## Application features

* **Pages** with addresses, titles, navigation icons, ordering and page-load actions; an optional **app shell** (top bar or side navigation) links them.
* **Variables** (optionally remembered per visitor), used in text as `{{vars.name}}`, two-way bound to form fields, changed by actions and used in visibility rules.
* **Data sources**: static JSON, REST APIs (any method, as a *query* that loads data or an *action* that buttons call) and **collections** that forms write to. Tables, lists, charts, selects and repeaters display them; `{{item.field}}` works inside repeaters and `{{data.name.length}}` anywhere.
* **Query framing, not query writing**: each source is shaped with point-and-click *filter* conditions, *search*, *sort*, *limit* and *keep fields*. Values from fields and variables are bound as parameters (never spliced into text), and the data reloads — debounced, cached and de-duplicated — when they change.
* **Actions** on click, submit, change and page load: go to page, open URL, show message, open/close dialog, set/toggle/increase variable, send form to an API, save form to a collection, clear a collection, reload data, reset form, scroll to a block.
* **Forms** validate with Material error messages (required, email, length, pattern) before their submit actions run.
* **Responsive editing**: desktop, tablet and mobile canvases use container queries, so the canvas behaves like the device; blocks can be hidden per device.
* **Studio**: drag from the library or drag templates in, reorder by the block handle, layers, breadcrumbs, undo/redo, copy/paste/duplicate, keyboard shortcuts, autosave, preview with live interactions, publish, export page HTML or project JSON, and import (including projects saved by the previous builder version, which are migrated automatically).

## Reactive UI logic

Blocks react to fields, variables and data without code. All logic is stored as JSON Logic and evaluated by the compiled engine in [`packages/json-logic`](../../packages/json-logic).

* **Block logic** (inspector → Logic): *Show when*, *Enable when* (a disabled section disables everything inside), *Require when*, *Computed value* (read-only, e.g. `qty × price`), *Options from* (dependent dropdowns) and *property bindings* (compute any property: text, label, color, image, items…).
* **Page rules** (left panel → Logic): one condition drives many blocks — show/hide, enable/disable, require/optional, set a property or set a field value once when the rule turns on. Rules apply in order; later rules win.
* **Computed variables**: a variable can follow a formula over fields, other variables and data.
* **Conditional actions**: every action has an optional *Only if…* condition; *Set field value* and *Call API* actions combine fields across a page.
* Editors offer three modes: **Conditions** (All/Any groups, nested, comparing to a typed value or another field), **Text** (templates with insertable values) and **JSON** (validated). Each shows its live result against the current page.
* Only the bindings whose inputs changed are re-evaluated (dependency paths come from static analysis of each rule). Computed fields that depend on each other are flagged in the studio and stopped at runtime.

The scope available to logic: `fields.<name>` (live form values), `vars.<name>`, `data.<source>` (framed rows), `page`, and `item` inside repeaters.

## Loading and motion

Skeletons at page, section, block and field level (tables, charts, lists, option lists, images, deferred sections) keep layout stable while data loads; below-the-fold sections of long pages render on viewport or idle (`@defer`). Route changes cross-fade with view transitions, blocks enter with `@starting-style`, and all motion respects `prefers-reduced-motion`.

## Requests

API actions and collection writes go through a queue: at most four in flight, retries with exponential backoff and jitter for network errors and 408/429/5xx, an `Idempotency-Key` header per request, and an offline outbox that is replayed when the browser comes back online. Cookie, Host, Origin and similar headers can't be set from the builder; keep secrets on the server.

## Storage

Projects are stored in the browser by default. Set `apiBaseUrl` in `src/environments/environment.ts` to the `web-builder-service` origin to store and publish them through `/web-builder/projects` instead.

With the service configured, collections are stored on the server (`/web-builder/runtime/:projectId/collections/:sourceId`). `POST …/query` runs the collection's *saved* query frame from the project: the client sends only parameter values, a search term and paging, so a visitor can never supply a query of their own.
