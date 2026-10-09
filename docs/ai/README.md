# Designing pages with any AI assistant

Any AI assistant (ChatGPT, Claude, Gemini, Copilot, Cursor…) can turn a **screenshot, Figma frame, wireframe or description** into a working page for the SPS Web Builder. The assistant replies with a **page spec** (JSON); you paste it into the builder and it renders immediately, ready to edit.

```
design (image / Figma / text) ──► AI assistant + PROMPT.md ──► page JSON ──► ✨ Import from AI / JSON ──► page on the canvas
                                                       ▲                                                   │
                                                       └──────── ⋮ Copy page as JSON (to change it) ◄──────┘
```

## Files

| File | What it is |
| --- | --- |
| [`PROMPT.md`](PROMPT.md) | The instruction prompt: rules, how to read a design, the spec format and the full catalog of blocks, properties, options and steps. **Generated from the builder's registry**, so it always matches what the builder can render. |
| [`page.schema.json`](page.schema.json) | The same contract as JSON Schema, for tools with structured output (OpenAI `response_format`, Gemini `responseSchema`, function calling). |
| [`examples/`](examples) | Valid specs: `contact.page.json` (form + validation + dialog) and `team-dashboard.page.json` (KPIs, chart, editable table, side-sheet form). |
| [`../../.claude/skills/web-builder-page-json/`](../../.claude/skills/web-builder-page-json/SKILL.md) | A skill for Claude (Claude Code picks it up automatically in this repo; upload the folder as a zip for claude.ai). |

The builder also has the prompt built in: **✨ Import from AI / JSON → Copy AI prompt** (or download it as `.md`, or download the JSON schema).

## Use it in your assistant

| Assistant | Set up once | Then |
| --- | --- | --- |
| **ChatGPT** | Create a GPT (Explore GPTs → Create). Paste `PROMPT.md` into *Instructions* (or upload it under *Knowledge* with the schema and examples). | Attach a screenshot or describe the page. |
| **Claude (claude.ai)** | Create a Project and paste `PROMPT.md` into the project instructions, **or** zip `.claude/skills/web-builder-page-json` and add it under Settings → Capabilities → Skills. | Attach a screenshot / paste a Figma link. With the Figma connector, Claude reads the frame directly. |
| **Claude Code** | Nothing — the skill is in `.claude/skills/` of this repo. | “Make a builder page from this screenshot” — it validates with `spec:check`. |
| **Gemini** | Create a Gem and paste `PROMPT.md` as its instructions. For the API, pass `page.schema.json` as `responseSchema`. | Attach the image. |
| **GitHub Copilot / Cursor** | Add `docs/ai/PROMPT.md` to the chat context (or reference it from `.github/copilot-instructions.md` / Cursor rules). | Ask for a page; save the reply as `*.page.json`. |
| **Any other tool** | Paste `PROMPT.md` as the first message. | Send the design. |

### From Figma

- **With a Figma tool/connector** (Figma MCP server, Dev Mode MCP): give the assistant the frame link. The prompt tells it to read the frame's structure (auto layout, spacing, text) with `get_design_context` instead of guessing from pixels.
- **Without one:** select the frame in Figma → *Export* → PNG (2x) and attach the image. Paste any copy that must be exact.

### Tips for good results

- One page per request. Name the page and say what each button should do (“Submit sends to https://api.example.com/leads, then shows a thank-you dialog”).
- Mention real data: “the table lists orders from GET https://api.example.com/orders (array in `data.items`)”. Without an API the assistant uses sample rows you can swap later in the Data panel.
- To change an existing page: **⋮ → Copy page as JSON**, paste it to the assistant with the change you want, then import the reply with **Replace this page**.

## Import into the builder

1. Open a project in the studio and click **✨** in the top bar (or **⋮ → Import from AI / JSON…**). From the projects list, **New app → From AI / JSON…** starts a fresh app with the dialog open.
2. Paste the assistant's reply — the whole message is fine, the JSON code block is found automatically — or load a `.json` file.
3. The **Check** column shows what will be built (a block outline), and lists problems with their location:
   - *fixed automatically* (warnings): e.g. `paragraph` → `text`, an unknown option replaced by the default, `"true"` → `true`, an unknown property dropped.
   - *errors*: e.g. an unknown block type (“Did you mean `button`?”), a `tab` outside `tabs`, invalid JSON with the line and column. Fix them in the text box or ask the assistant to fix them (paste the messages back).
4. Choose **New page**, **Add to this page** or **Replace this page** (and optionally **Use its theme**), then **Import**. Undo (Ctrl+Z) restores the previous version.

## Validate from the command line

```bash
pnpm --filter @spsedu360/web-builder spec:check docs/ai/examples/team-dashboard.page.json
```

Same checks as the import dialog; exits with code 1 when a file has errors — handy in CI or for agents.

## Keep the kit in sync

`PROMPT.md`, `page.schema.json` and the skill's references are generated. After adding or changing blocks, properties or step types, run:

```bash
pnpm --filter @spsedu360/web-builder ai:docs
```

A unit test fails if `PROMPT.md` is out of date.

## Spec at a glance

```json
{
  "format": "web-builder/page@1",
  "name": "Pricing",
  "path": "pricing",
  "theme": { "primary": "iris", "headingFont": "Geist", "radius": "medium" },
  "blocks": [
    { "type": "section", "props": { "padding": "8", "surface": "glow" }, "children": [
      { "type": "heading", "props": { "text": "Simple pricing", "level": "1", "variant": "display-sm" } },
      { "type": "button", "props": { "text": "Start free", "variant": "filled" },
        "actions": [["click", "openDialog", "@block:Sign up"]] }
    ] },
    { "type": "dialog", "name": "Sign up", "props": { "title": "Create your account" }, "children": [] }
  ],
  "sources": [], "variables": [], "functions": [], "workflows": []
}
```

Blocks use `type`, `props`, `children`, `actions` (steps with `onSuccess` / `onError`), `validations`, `logic` and `table`; references use names (`@block:Name`, `@source:name`, `@workflow:Name`, `@variable:name`, `@page:Name`) so specs never contain ids. See `PROMPT.md` for everything else.
