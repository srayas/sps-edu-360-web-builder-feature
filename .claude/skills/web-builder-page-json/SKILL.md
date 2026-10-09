---
name: web-builder-page-json
description: Turn a screenshot, Figma frame, wireframe or description of a page into SPS Web Builder page JSON that imports with "Import from AI / JSON", or edit an exported page JSON. Use whenever someone asks to design, convert, build or change a page for the SPS web builder.
---

# SPS Web Builder page JSON

The SPS Web Builder (Angular Material 3) renders pages from a **page spec**: JSON with blocks, steps, validation, tables, logic and data sources. People paste the spec into the studio with **✨ Import from AI / JSON** and the page appears on the canvas, fully editable and working.

## Steps

1. **Load the reference.** Read `references/PROMPT.md` completely before writing JSON. It is generated from the builder's registry and lists every block type, property, option value, step type, validation kind, table format and theme value. Never use a type, property or option that is not listed there. `references/page.schema.json` is the same contract as JSON Schema.
2. **Understand the design.**
   - Image or screenshot: look at it region by region (navigation, hero, sections, cards, forms, tables, footer). Copy the real text.
   - Figma link: if Figma tools are available, call `get_design_context` (or `get_metadata` + `get_screenshot`) for the frame and use its structure, auto-layout direction, spacing and text. Map auto layout as described in the reference (vertical → `stack`, horizontal → `row`, grids → `grid`, filled frames → `card`/`surface`) and spacing in px to the 0–8 tokens.
   - Description only: design a clean, modern page with sensible sections and real-sounding copy.
   - Existing page JSON (exported with **⋮ → Copy page as JSON**): change only what was asked and keep every `name`, `@block:` reference and data source name so links keep working; return the whole spec.
3. **Make it work.** Every form field gets a unique `field` and fitting `validations`; every button or row action gets steps; submissions and API calls get `onSuccess` feedback and an `onError` path; lists and tables use `sources` (static sample rows when no API is known, `collection` when rows are edited or deleted); dialogs are top-level `dialog` blocks with a `name`, opened by `openDialog` with `@block:Name`.
4. **Stay on theme.** No CSS, pixels or colors: layout through layout blocks and spacing tokens, color through `surface`/`tone`/`variant`/`severity` and the `theme`.
5. **Check before replying.** Walk the checklist at the end of `references/PROMPT.md`. When this repository is available, save the JSON to a file and run
   `pnpm --filter @spsedu360/web-builder spec:check <file>` — it runs the same validation as the import dialog and explains every problem. Fix all errors (lines starting with `error`).
6. **Reply** with one ```json block containing the spec (no comments, no trailing commas). After it, add one line telling the user to paste it into the builder with ✨ **Import from AI / JSON** (New page, Add to this page, or Replace this page).

## Examples

- `docs/ai/examples/contact.page.json` — hero, stats, contact form with validation, submit with success dialog and error toast.
- `docs/ai/examples/team-dashboard.page.json` — toolbar, KPI grid, chart, editable data table with badges, row delete with confirmation, side-sheet form saving to a collection.
