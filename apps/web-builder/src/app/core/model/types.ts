/**
 * Project schema (version 2) for the web application builder.
 *
 * A project is a multi-page application: pages hold a tree of blocks; blocks have typed props,
 * optional user style overrides, event actions and visibility rules. Application state lives in
 * variables and data sources. Unless a user overrides something, every block renders with the
 * project's Material theme and the shared layout presets.
 */

export type PropValue = string | number | boolean
export type Props = Record<string, PropValue>
export type StyleMap = Record<string, string>
export type Viewport = 'desktop' | 'tablet' | 'mobile'
export type StyleScope = 'styles' | 'tabletStyles' | 'mobileStyles'

export type Trigger = 'click' | 'submit' | 'change' | 'load'

export type ActionType =
  | 'navigate'
  | 'openUrl'
  | 'showMessage'
  | 'openDialog'
  | 'closeDialog'
  | 'setVariable'
  | 'toggleVariable'
  | 'incrementVariable'
  | 'submitForm'
  | 'saveToCollection'
  | 'clearCollection'
  | 'refreshData'
  | 'resetForm'
  | 'scrollTo'
  | 'setField'
  | 'callApi'

/**
 * One step in an event handler. Steps for the same trigger run in order and stop at the first
 * failure. `target` and `value` are interpreted per action type (see ACTION_DEFINITIONS).
 */
export interface Action {
  id: string
  trigger: Trigger
  type: ActionType
  target: string
  value: string
  /** Optional condition; the step is skipped when it evaluates falsy. */
  when?: Expr
}

/**
 * A reusable piece of UI logic. Every kind compiles to a JSON Logic rule evaluated against the
 * page scope: `fields.*` (live values of all fields on the page), `vars.*`, `data.*`, `item.*`
 * (inside a repeater), `index`, `page.*` and `app.*`. Nobody has to type code: `conditions` and
 * `template` come from visual editors; `rule` is the advanced JSON form.
 */
export type Expr =
  | { kind: 'conditions'; group: ConditionGroup }
  | { kind: 'template'; text: string }
  | { kind: 'rule'; rule: unknown }

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains'
  | 'not_contains'
  | 'starts'
  | 'ends'
  | 'in'
  | 'not_in'
  | 'empty'
  | 'not_empty'
  | 'true'
  | 'false'

export interface Condition {
  /** Scope path, e.g. `fields.country`, `vars.plan`, `data.orders.length`. */
  field: string
  operator: ConditionOperator
  value?: unknown
  value2?: unknown
  /** `literal` (typed value) or `field` (another scope path). */
  source?: 'literal' | 'field' | 'param'
}

export interface ConditionGroup {
  combinator: 'and' | 'or'
  conditions: (Condition | ConditionGroup)[]
}

/** Reactive bindings that let other fields, variables or data drive a block. */
export interface BlockLogic {
  /** Shown only while true (combined with the simple visibility settings). */
  visible?: Expr
  /** Interactive only while true; disabling a container disables everything inside it. */
  enabled?: Expr
  /** Form fields: required only while true. */
  required?: Expr
  /** Form fields: value is computed continuously and shown read-only. */
  value?: Expr
  /** Choice fields: options computed from other values (list of strings or {label, value}). */
  options?: Expr
  /** Any property computed from logic, e.g. `text`, `label`, `surface`, `items`. */
  props?: Record<string, Expr>
}

export interface Visibility {
  /** Variable id; empty means always visible. */
  variable: string
  /** When set, the variable must equal this value; otherwise it must be truthy. */
  equals: string
  /** Invert the rule (hide when it matches). */
  negate: boolean
  /** Viewports on which the block is hidden. */
  hideOn: Viewport[]
}

export interface Block {
  id: string
  type: string
  name: string
  props: Props
  styles: StyleMap
  tabletStyles: StyleMap
  mobileStyles: StyleMap
  actions: Action[]
  visibility: Visibility
  logic: BlockLogic
  children: Block[]
}

export type EffectKind =
  | 'show'
  | 'hide'
  | 'enable'
  | 'disable'
  | 'require'
  | 'optional'
  | 'set-prop'
  | 'set-value'

export interface RuleEffect {
  id: string
  /** Target block id. */
  target: string
  kind: EffectKind
  /** Property name for `set-prop`. */
  prop?: string
  /** Value for `set-prop` / `set-value`. */
  value?: Expr
}

/**
 * Page rule: while `when` is true the effects apply (show/hide/enable/disable/require continuously;
 * `set-value` once each time the condition becomes true); otherwise the `otherwise` effects apply.
 */
export interface PageRule {
  id: string
  name: string
  enabled: boolean
  when: Expr
  effects: RuleEffect[]
  otherwise: RuleEffect[]
}

export interface Page {
  id: string
  name: string
  slug: string
  title: string
  icon: string
  inNav: boolean
  actions: Action[]
  rules: PageRule[]
  blocks: Block[]
}

export interface Variable {
  id: string
  name: string
  initial: string
  /** Keep the value between visits (stored in the visitor's browser). */
  persist: boolean
  /** Computed variable: when set, the value is derived from this expression and read-only. */
  formula?: Expr
}

export type DataSourceKind = 'static' | 'rest' | 'collection'

export interface SortSpec {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * A framed query: which rows, in which order, which fields. Built visually; never query text.
 * Values may reference the page scope through `{{…}}` templates or condition values.
 */
export interface QueryFrame {
  filter?: Expr
  /** Template for a text search, e.g. `{{fields.search}}`. */
  search: string
  searchFields: string[]
  sort: SortSpec[]
  limit: number
  select: string[]
  /** Reshape each row (JSON Logic returning an object). */
  transform?: Expr
}

export interface KeyValue {
  key: string
  /** Template; may use `{{fields.x}}`, `{{vars.y}}`… */
  value: string
}

export interface DataSource {
  id: string
  name: string
  kind: DataSourceKind
  /** JSON array used by `static` sources and as the seed of `collection` sources. */
  json: string
  /** Endpoint for `rest` sources (https or same-origin path); may contain `{{…}}` templates. */
  url: string
  /** Dot path to the array inside a REST response, e.g. `data.items`. */
  path: string
  /** `query` sources load data; `mutation` sources are called by actions (POST/PUT/PATCH/DELETE). */
  mode: 'query' | 'mutation'
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Query-string parameters (templates). */
  params: KeyValue[]
  /** Request headers (templates). Never put secrets here: they ship to the browser. */
  headers: KeyValue[]
  /** JSON body template for mutations; `{{form}}`-style bindings are resolved as JSON values. */
  body: string
  /** Rows are shaped by this frame after loading. */
  query: QueryFrame
  /** Load automatically when the page opens and whenever the values it uses change. */
  autoLoad: boolean
  /** Reuse a response for this many seconds (0 = always fetch). */
  cacheSeconds: number
  /** Re-fetch periodically while the page is open (0 = never). */
  refreshSeconds: number
}

export const PALETTES = [
  'azure',
  'blue',
  'cyan',
  'spring-green',
  'green',
  'chartreuse',
  'yellow',
  'orange',
  'red',
  'rose',
  'magenta',
  'violet',
] as const
export type Palette = (typeof PALETTES)[number]

export const FONTS = [
  'Public Sans',
  'Geist',
  'Inter',
  'Roboto',
  'Poppins',
  'Lato',
  'Montserrat',
  'Merriweather',
  'Playfair Display',
] as const
export type FontName = (typeof FONTS)[number]

export const RADII = ['none', 'small', 'medium', 'large', 'round'] as const
export type Radius = (typeof RADII)[number]

export interface ThemeSettings {
  primary: Palette
  tertiary: Palette
  bodyFont: FontName
  headingFont: FontName
  /** Material density scale, 0 (default) to -4 (compact). */
  density: number
  radius: Radius
  mode: 'light' | 'dark' | 'system'
}

export interface ShellSettings {
  /** Wrap every page in a Material app frame with navigation to pages marked `inNav`. */
  enabled: boolean
  layout: 'top' | 'side'
  title: string
  icon: string
  footer: string
}

export interface Project {
  version: 2
  id: string
  name: string
  theme: ThemeSettings
  shell: ShellSettings
  pages: Page[]
  variables: Variable[]
  dataSources: DataSource[]
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  pages: number
  updatedAt: string
  published: boolean
}
