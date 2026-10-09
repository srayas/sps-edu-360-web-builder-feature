/**
 * Instructions for AI assistants that turn a design (screenshot, Figma frame, sketch or
 * description) into a page spec. The block, step, format and option lists are generated from
 * the registry, so the prompt always matches what this builder can render.
 */
import {
  ACTION_DEFINITIONS,
  BLOCK_DEFINITIONS,
  BlockGroup,
  PropDef,
  TRIGGER_LABELS,
} from './registry'
import { CELL_KINDS, COLUMN_FORMATS, TONES } from './table'
import { VALIDATION_DEFINITIONS } from './validation'
import { FONTS, PALETTES, RADII } from './types'
import { SPEC_FORMAT, PageSpec } from './ai-spec'

const GROUPS: BlockGroup[] = [
  'Layout',
  'Content',
  'Navigation',
  'Forms',
  'Data',
  'Overlays',
]

function propLine(prop: PropDef): string {
  const options = prop.options?.length
    ? ` — one of: ${prop.options.map((option) => option.value).join(' | ')}`
    : ''
  const fallback =
    prop.default === '' || prop.default === undefined
      ? ''
      : ` (default ${JSON.stringify(prop.default)})`
  const hint = prop.hint ? ` — ${prop.hint}` : ''
  return `  - \`${prop.key}\` ${prop.kind}${fallback}${options}${hint}`
}

/** Markdown reference of every block and its properties. */
export function blockCatalog(): string {
  const out: string[] = []
  // Props shared by many blocks (gap, padding, surface…) are described once, then only named.
  const seen = new Set<string>()
  const signature = (prop: PropDef) =>
    `${prop.key}|${prop.kind}|${(prop.options ?? []).map((option) => option.value).join(',')}`
  for (const group of GROUPS) {
    out.push(`### ${group}`)
    for (const def of BLOCK_DEFINITIONS.filter(
      (item) => item.group === group,
    )) {
      const facts = [
        def.container
          ? def.accepts
            ? `children: only ${def.accepts.join(', ')}`
            : 'children: yes'
          : 'no children',
        def.parents ? `only inside ${def.parents.join(' / ')}` : '',
        def.events?.length ? `events: ${def.events.join(', ')}` : '',
      ].filter(Boolean)
      out.push(`- **${def.type}** — ${def.description} _(${facts.join('; ')})_`)
      const repeated: string[] = []
      for (const prop of def.props) {
        const key = signature(prop)
        if (seen.has(key) && prop.options?.length)
          repeated.push(
            `\`${prop.key}\`${prop.default === '' ? '' : `=${JSON.stringify(prop.default)}`}`,
          )
        else out.push(propLine(prop))
        seen.add(key)
      }
      if (repeated.length)
        out.push(
          `  - also (same options as above, default shown): ${repeated.join(', ')}`,
        )
    }
    out.push('')
  }
  return out.join('\n')
}

/** Markdown reference of every step type. */
export function actionCatalog(): string {
  const targets: Record<string, string> = {
    none: '—',
    page: '@page:Name',
    url: 'https URL',
    dialog: '@block:Dialog name',
    block: '@block:Name',
    variable: '@variable:name',
    source: '@source:name',
    collection: '@source:name (collection)',
    mutation: '@source:name (mutation)',
    workflow: '@workflow:Name',
    field: 'field name',
  }
  return ACTION_DEFINITIONS.map((def) => {
    const value =
      def.value === 'none' ? '' : ` · value: ${def.valueLabel ?? def.value}`
    const outcomes = def.outcomes
      ? ` · branches: onSuccess (${def.outcomes[0]}) / onError (${def.outcomes[1]})`
      : ''
    const response = def.responseHint
      ? ` · {{response}} = ${def.responseHint}`
      : ''
    return `- **${def.type}** — ${def.label} · target: ${targets[def.target] ?? def.target}${value}${outcomes}${response}`
  }).join('\n')
}

/** A complete, valid example used in the prompt and checked by the tests. */
export const EXAMPLE_SPEC: PageSpec = {
  format: SPEC_FORMAT,
  name: 'Contact',
  path: 'contact',
  theme: {
    primary: 'iris',
    headingFont: 'Geist',
    bodyFont: 'Geist',
    radius: 'medium',
  },
  blocks: [
    {
      type: 'toolbar',
      props: { title: 'Acme', icon: 'bolt' },
      children: [
        { type: 'nav', props: { usePages: true } },
        {
          type: 'button',
          props: { text: 'Sign in', variant: 'tonal' },
          actions: [['click', 'navigate', '@page:first']],
        },
      ],
    },
    {
      type: 'section',
      props: { padding: '8', surface: 'glow' },
      children: [
        {
          type: 'container',
          props: { width: 'lg', gap: '4', align: 'center' },
          children: [
            { type: 'badge', props: { text: 'We reply within a day' } },
            {
              type: 'heading',
              props: {
                text: 'Talk to our team',
                level: '1',
                variant: 'display-sm',
                textAlign: 'center',
              },
            },
            {
              type: 'text',
              props: {
                text: 'Questions about plans, pricing or a demo? Send us a note.',
                tone: 'muted',
                textAlign: 'center',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'section',
      props: { padding: '7' },
      children: [
        {
          type: 'container',
          props: { width: 'lg', gap: '6' },
          children: [
            {
              type: 'grid',
              props: {
                columns: '3',
                tabletColumns: '3',
                mobileColumns: '1',
                gap: '4',
              },
              children: [
                {
                  type: 'stat',
                  props: {
                    label: 'Customers',
                    value: '2,400+',
                    icon: 'groups',
                  },
                },
                {
                  type: 'stat',
                  props: {
                    label: 'Uptime',
                    value: '99.99%',
                    icon: 'monitoring',
                  },
                },
                {
                  type: 'stat',
                  props: {
                    label: 'Median reply',
                    value: '3 h',
                    icon: 'schedule',
                  },
                },
              ],
            },
            {
              type: 'card',
              props: { title: 'Send a message', appearance: 'outlined' },
              children: [
                {
                  type: 'form',
                  name: 'Contact form',
                  props: { gap: '3' },
                  children: [
                    {
                      type: 'input',
                      props: {
                        label: 'Full name',
                        field: 'name',
                        required: true,
                      },
                      validations: [
                        { kind: 'letters', message: 'Use letters only.' },
                      ],
                    },
                    {
                      type: 'input',
                      props: {
                        label: 'Work email',
                        field: 'email',
                        inputType: 'email',
                        required: true,
                      },
                      validations: [{ kind: 'email' }],
                    },
                    {
                      type: 'select',
                      props: {
                        label: 'Topic',
                        field: 'topic',
                        items: 'Sales\nSupport\nPartnerships',
                      },
                    },
                    {
                      type: 'textarea',
                      props: {
                        label: 'Message',
                        field: 'message',
                        rows: 4,
                        required: true,
                      },
                      validations: [
                        {
                          kind: 'minLength',
                          value: '20',
                          message: 'Tell us a little more (20+ characters).',
                        },
                      ],
                    },
                    {
                      type: 'button',
                      props: {
                        text: 'Send',
                        variant: 'filled',
                        htmlType: 'submit',
                        icon: 'send',
                      },
                    },
                  ],
                  actions: [
                    {
                      trigger: 'submit',
                      type: 'submitForm',
                      target: 'https://api.example.com/contact',
                      value: 'POST',
                      onSuccess: [
                        { type: 'openDialog', target: '@block:Thanks' },
                      ],
                      onError: [
                        {
                          type: 'showMessage',
                          value: '{{error.message}}',
                          options: {
                            severity: 'error',
                            title: 'Could not send',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'dialog',
      name: 'Thanks',
      props: { title: 'Message sent', presentation: 'dialog', size: 'sm' },
      children: [
        {
          type: 'text',
          props: {
            text: 'Thanks {{form.name}} — we will reply to {{form.email}} soon.',
          },
        },
        {
          type: 'button',
          props: { text: 'Close', variant: 'filled' },
          actions: [['click', 'closeDialog']],
        },
      ],
    },
  ],
}

/** The full instruction prompt for an AI assistant. */
export function aiPrompt(): string {
  return `# SPS Web Builder — design → page JSON

You turn a UI design into a **page spec**: JSON that the SPS Web Builder (Angular Material 3) renders as a real, working page. The input can be a screenshot, a Figma frame or link, a wireframe, or a text description. Paste the result into the builder with **⋮ → Import from AI / JSON** and the page appears on the canvas, ready to edit.

## Output rules

1. Reply with **one \`\`\`json block** containing the page spec and nothing else, unless the user asks for explanations. Never leave comments or trailing commas inside the JSON.
2. Use **only** the block types, property names and option values listed in the catalog below. Anything else is dropped. Values for \`select\` properties must be one of the listed option values.
3. **No CSS, no pixel values, no colors.** Layout comes from layout blocks plus spacing tokens (\`gap\`, \`padding\`); color comes from \`surface\`, \`tone\`, \`variant\`, \`severity\` tokens and the \`theme\`. The theme keeps every page consistent in light and dark mode.
4. Copy real text from the design (headings, labels, button text, table headers). Do not use lorem ipsum. For images use the URL if you have one, otherwise \`https://picsum.photos/seed/<word>/1200/800\` with a meaningful \`alt\`.
5. Make it work, not just look right: give form fields a \`field\` name, add validation rules, wire buttons with steps (\`actions\`), use data sources for lists and tables, and show feedback with notifications or dialogs.
6. Give a \`name\` to every block that a step refers to (dialogs, sections to scroll to, cell blocks) and refer to it as \`@block:Name\`.
7. Omitted style properties use the default shown in the catalog; omitted content properties (texts, images, items) stay empty, so write every piece of text the design shows.
8. Keep it responsive: use \`grid\` with \`columns\`/\`tabletColumns\`/\`mobileColumns\`, \`row\` with \`stackOnMobile\` or \`wrap\`, and \`container\` widths.

## Reading a design

- Work top to bottom and split the page into regions: app bar / navigation → hero → content sections → footer. Each full-width band is a \`section\` (background via \`surface\`, vertical rhythm via \`padding\`) with a \`container\` inside (content width + \`gap\`).
- **Figma auto layout**: vertical → \`stack\`, horizontal → \`row\` (\`wrap\` if it wraps), grid/repeated cards → \`grid\`, a frame with a fill or border → \`card\` or a block with \`surface\`/\`outlined\`/\`elevation\`. If a Figma tool is available (for example \`get_design_context\` or \`get_metadata\` from the Figma MCP server), read the frame's structure and text from it instead of guessing from pixels.
- **Spacing → tokens**: 0→\`0\`, 4px→\`1\`, 8px→\`2\`, 12px→\`3\`, 16px→\`4\`, 24px→\`5\`, 32px→\`6\`, 48px→\`7\`, 64px+→\`8\`. Corner radius → \`corner\`; shadow → \`elevation\`.
- **Typography**: page title → \`heading\` level 1 with a \`display-*\` or \`headline-lg\` variant; section titles → level 2 \`headline-*\`; card titles → \`title-*\`; body copy → \`text\` (\`body-lg\`/\`body-md\`); secondary text → \`tone: "muted"\`.
- **Controls**: text boxes → \`input\` (\`inputType\` email/password/number/tel/url), multi-line → \`textarea\`, dropdowns → \`select\`, toggles → \`switch\`, segmented buttons → \`toggle-group\`, dates → \`datepicker\`. Wrap fields that submit together in a \`form\` with a submit \`button\` (\`htmlType: "submit"\`).
- **Data**: tables → \`table\` (columns, formats, row actions); repeated cards from data → \`repeater\` over a source with \`{{item.field}}\` inside; KPIs → \`stat\`; charts → \`chart\`.
- **Overlays**: modals/side panels/bottom sheets → a top-level \`dialog\` (\`presentation\`: dialog | side | bottom | fullscreen) opened by an \`openDialog\` step. Toasts → \`showMessage\` steps.
- Icons use Material Symbols names (\`search\`, \`arrow_forward\`, \`settings\`, \`person\`, \`shopping_cart\`…).

## Spec format

\`\`\`jsonc
{
  "format": "${SPEC_FORMAT}",
  "name": "Pricing",            // page name (also the title)
  "path": "pricing",            // URL path
  "theme": { "primary": "iris", "headingFont": "Geist", "bodyFont": "Geist", "radius": "medium", "mode": "system" },
  "blocks": [ /* block nodes, top to bottom */ ],
  "actions": [ /* page steps, e.g. { "trigger": "load", "type": "refreshData", "target": "@source:plans" } */ ],
  "sources": [ /* data sources */ ],
  "variables": [ /* page state */ ],
  "functions": [ /* reusable calculations */ ],
  "workflows": [ /* reusable step chains */ ]
}
\`\`\`

**Block node**: \`{ "type": "...", "name"?: "...", "props"?: {…}, "children"?: [nodes], "actions"?: [steps], "validations"?: [rules], "logic"?: {…}, "table"?: {…} }\`. Only container blocks take \`children\`. \`items\` properties take one entry per line — you may pass an array of strings (use \`"Label|value"\` or the documented \`a|b|c\` pattern per line).

**Steps** (\`actions\`): \`{ "trigger": "click", "type": "showMessage", "target"?: "...", "value"?: "...", "options"?: {…}, "onSuccess"?: [steps], "onError"?: [steps], "branches"?: [[steps],[steps]], "expr"?: expression }\` or the short tuple \`["click", "navigate", "@page:Home"]\`. Triggers: ${Object.entries(
    TRIGGER_LABELS,
  )
    .map(([key, label]) => `\`${key}\` (${label.toLowerCase()})`)
    .join(
      ', ',
    )}. Buttons fire \`click\`, forms \`submit\`, fields \`change\`, tables \`rowClick\`. Steps run in order; a failing step runs its \`onError\` steps (with \`{{error.message}}\`, \`{{error.status}}\`) and stops the chain; \`onSuccess\` steps see \`{{response}}\`. Options: \`saveAs\` (keep the result as \`{{steps.<name>}}\`), \`continueOnError: "true"\`; \`showMessage\` takes \`severity\` (info | success | warning | error), \`title\`, \`position\` (bottom-center | top-end …), \`duration\` (seconds); \`confirm\` takes \`title\`, \`confirmLabel\`, \`danger: "true"\`; \`runWorkflow\` takes \`in_<param>\` inputs; \`parallel\` runs \`branches\` at the same time (option \`mode\`: all | settled).

**Values and expressions**: any text property can contain \`{{path}}\` placeholders. Paths: \`fields.<field>\` (form values on the page), \`form.<field>\` (inside a form's steps), \`vars.<name>\` (variables), \`data.<source>\` (rows of a query source), \`item.<key>\` / \`index\` (inside a repeater), \`row.<key>\` (table rows), \`response\`, \`error\`, \`steps.<name>\`, \`input.<param>\` (inside workflows). An expression is \`{ "kind": "template", "text": "Total: {{fields.qty}}" }\`, \`{ "kind": "rule", "rule": <JSON Logic> }\` (e.g. \`{"*": [{"var": "fields.qty"}, {"var": "fields.price"}]}\`), or \`{ "kind": "conditions", "group": { "combinator": "and", "conditions": [{ "field": "fields.country", "operator": "eq", "value": "India" }] } }\`. Operators: eq, neq, gt, gte, lt, lte, between, contains, not_contains, starts, ends, in, not_in, empty, not_empty, true, false. A plain string is read as a template and a plain JSON Logic object as a rule. Call a function with \`{"fn": ["name", arg1, arg2]}\`.

**Logic** (\`logic\` on a block): \`visible\`, \`enabled\`, \`required\` (conditions), \`value\` (computed field value), \`options\` (computed choices), \`props\` (any property computed, e.g. \`{ "text": "Hello {{fields.name}}" }\`).

**Validation** (\`validations\` on form fields): \`[{ "kind": "email", "message"?: "…", "value"?: "…", "when"?: expression, "expr"?: expression }]\`. Kinds: ${VALIDATION_DEFINITIONS.map((item) => `\`${item.kind}\`${item.value !== 'none' ? ` (value: ${item.valueLabel ?? item.value})` : ''}`).join(', ')}.

**Tables** (\`table\` on a \`table\` block): \`{ "columns": [{ "id": "qty", "field": "qty", "header": "Qty", "format": "number", "align": "end", "cell"?: "number", "autoSave"?: true, "validations"?: […], "onChange"?: [steps], "value"?: expression, "tones"?: [{ "tone": "error", "when": expression }], "mergeEqual"?: true, "cellWhen"?: expression, "cellBlock"?: "@block:Cell name" }], "rowActions": [{ "label": "Edit", "icon": "edit", "display": "icon", "actions": [steps with {{row.*}}] }], "merges"?: [{ "column": "<column id>", "colspan": 2, "rowspan": 1, "when"?: expression, "rows"?: "1, 3-4" }], "headerGroups"?: [{ "label": "Amount", "column": "<first column id>", "span": 2 }], "rowTones"?: [{ "tone": "muted", "when": expression }], "emptyText"?: "…" }\`. Formats: ${COLUMN_FORMATS.map((item) => item.value).join(', ')}. Cell types: ${CELL_KINDS.map((item) => item.value).join(', ')} (\`blocks\` = a \`table-cell\` child of the table, named and referenced by \`cellBlock\`). Tones: ${TONES.filter(
    (item) => item.value,
  )
    .map((item) => item.value)
    .join(', ')}.

**Data sources**: \`{ "name": "orders", "kind": "static" | "rest" | "collection", "json"?: [rows], "url"?: "https://…", "path"?: "data.items", "method"?: "GET", "mode"?: "query" | "mutation", "autoLoad"?: true }\`. Use \`static\` with sample rows when the design shows data but no API is known; \`collection\` for records the app edits (tables with edit/delete); \`rest\` for real endpoints. Reference with \`"source": "@source:orders"\` and in text as \`{{data.orders}}\`. Never put secrets or API keys in a spec.

**Variables**: \`{ "name": "plan", "initial": "pro", "persist"?: false, "formula"?: expression }\`. **Functions**: \`{ "name": "lineTotal", "params": [{ "name": "qty" }, { "name": "price" }], "body": { "kind": "rule", "rule": {"*": [{"var": "qty"}, {"var": "price"}]} } }\`. **Workflows**: \`{ "name": "Place order", "params": [{ "name": "qty" }], "steps": [steps using {{input.qty}} and saveAs], "output": expression }\`, run with \`{ "type": "runWorkflow", "target": "@workflow:Place order", "options": { "in_qty": "{{fields.qty}}" } }\`.

**Theme**: primary/tertiary palette ${PALETTES.join(', ')}; fonts ${FONTS.join(', ')}; radius ${RADII.join(', ')}; mode light | dark | system; density 0 to -4.

## Block catalog

${blockCatalog()}
## Step types

${actionCatalog()}

## Example

\`\`\`json
${JSON.stringify(EXAMPLE_SPEC, null, 2)}
\`\`\`

## Before you reply, check

- Every \`type\`, property and option value exists in the catalog; \`tab\`/\`panel\`/\`step\`/\`table-cell\` only inside their parents; \`dialog\` only at the top level.
- Every form field has a unique \`field\`; submit buttons use \`htmlType: "submit"\`.
- Every \`@block:\`, \`@source:\`, \`@workflow:\`, \`@variable:\`, \`@page:\` reference matches a name you defined (or an existing page/source).
- Every interactive element does something, and every request has an \`onError\` path.
- The JSON parses (no comments, no trailing commas).
`
}

/** JSON Schema of the page spec (for tools with structured output). */
export function specSchema(): Record<string, unknown> {
  const types = BLOCK_DEFINITIONS.map((def) => def.type)
  const propSchema = (prop: PropDef): Record<string, unknown> => {
    switch (prop.kind) {
      case 'toggle':
        return { type: 'boolean' }
      case 'number':
        return {
          type: 'number',
          ...(prop.min !== undefined ? { minimum: prop.min } : {}),
          ...(prop.max !== undefined ? { maximum: prop.max } : {}),
        }
      case 'select':
        return {
          type: 'string',
          enum: (prop.options ?? []).map((option) => option.value),
        }
      case 'items':
        return {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
          ],
        }
      default:
        return { type: 'string' }
    }
  }
  const expr = { $ref: '#/$defs/expr' }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://spsedu360.dev/schemas/web-builder-page.json',
    title: 'SPS Web Builder page spec',
    type: 'object',
    required: ['blocks'],
    properties: {
      format: { const: SPEC_FORMAT },
      name: { type: 'string' },
      title: { type: 'string' },
      path: { type: 'string' },
      icon: { type: 'string' },
      inNav: { type: 'boolean' },
      theme: {
        type: 'object',
        properties: {
          primary: { enum: [...PALETTES] },
          tertiary: { enum: [...PALETTES] },
          bodyFont: { enum: [...FONTS] },
          headingFont: { enum: [...FONTS] },
          radius: { enum: [...RADII] },
          mode: { enum: ['light', 'dark', 'system'] },
          density: { type: 'integer', minimum: -4, maximum: 0 },
        },
      },
      blocks: { type: 'array', items: { $ref: '#/$defs/node' } },
      actions: { type: 'array', items: { $ref: '#/$defs/step' } },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'kind'],
          properties: {
            name: { type: 'string', pattern: '^\\w+$' },
            kind: { enum: ['static', 'rest', 'collection'] },
            json: {},
            url: { type: 'string' },
            path: { type: 'string' },
            method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
            mode: { enum: ['query', 'mutation'] },
            autoLoad: { type: 'boolean' },
          },
        },
      },
      variables: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            initial: { type: 'string' },
            persist: { type: 'boolean' },
            formula: expr,
          },
        },
      },
      functions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'body'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            params: { type: 'array', items: { $ref: '#/$defs/param' } },
            body: expr,
          },
        },
      },
      workflows: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'steps'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            params: { type: 'array', items: { $ref: '#/$defs/param' } },
            steps: { type: 'array', items: { $ref: '#/$defs/step' } },
            output: expr,
          },
        },
      },
    },
    $defs: {
      param: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          defaultValue: { type: 'string' },
        },
      },
      expr: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            required: ['kind', 'text'],
            properties: {
              kind: { const: 'template' },
              text: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['kind', 'rule'],
            properties: { kind: { const: 'rule' }, rule: {} },
          },
          {
            type: 'object',
            required: ['kind', 'group'],
            properties: {
              kind: { const: 'conditions' },
              group: { type: 'object' },
            },
          },
        ],
      },
      step: {
        oneOf: [
          {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: { type: 'string' },
          },
          {
            type: 'object',
            required: ['type'],
            properties: {
              trigger: { enum: Object.keys(TRIGGER_LABELS) },
              type: { enum: ACTION_DEFINITIONS.map((def) => def.type) },
              target: { type: 'string' },
              value: { type: 'string' },
              options: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
              expr,
              onSuccess: { type: 'array', items: { $ref: '#/$defs/step' } },
              onError: { type: 'array', items: { $ref: '#/$defs/step' } },
              branches: {
                type: 'array',
                items: { type: 'array', items: { $ref: '#/$defs/step' } },
              },
            },
          },
        ],
      },
      node: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { enum: types },
          name: { type: 'string' },
          props: { type: 'object' },
          children: { type: 'array', items: { $ref: '#/$defs/node' } },
          actions: { type: 'array', items: { $ref: '#/$defs/step' } },
          validations: {
            type: 'array',
            items: {
              type: 'object',
              required: ['kind'],
              properties: {
                kind: { enum: VALIDATION_DEFINITIONS.map((item) => item.kind) },
                value: { type: 'string' },
                message: { type: 'string' },
                when: expr,
                expr,
              },
            },
          },
          logic: {
            type: 'object',
            properties: {
              visible: expr,
              enabled: expr,
              required: expr,
              value: expr,
              options: expr,
              props: { type: 'object', additionalProperties: expr },
            },
          },
          table: { type: 'object' },
        },
        allOf: BLOCK_DEFINITIONS.map((def) => ({
          if: { properties: { type: { const: def.type } } },
          then: {
            properties: {
              props: {
                type: 'object',
                additionalProperties: false,
                properties: Object.fromEntries(
                  def.props.map((prop) => [prop.key, propSchema(prop)]),
                ),
              },
            },
          },
        })),
      },
    },
  }
}
