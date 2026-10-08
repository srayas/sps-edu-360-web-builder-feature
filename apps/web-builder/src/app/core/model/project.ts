/**
 * Pure project operations: creation, tree edits, migration and validated import.
 * Everything here works on plain data so it can run in the browser, in tests and on the server.
 */
import {
  BlockSpec,
  canContain,
  defaultProps,
  definition,
  isContainer,
  ACTION_DEFINITIONS,
} from './registry'
import { safeStyle } from './styles'
import {
  Action,
  Block,
  DataSource,
  FONTS,
  Page,
  PALETTES,
  Project,
  Props,
  RADII,
  ShellSettings,
  StyleMap,
  ThemeSettings,
  Trigger,
  Variable,
  Viewport,
  Visibility,
  BlockLogic,
  Condition,
  ConditionGroup,
  EffectKind,
  Expr,
  KeyValue,
  PageRule,
  QueryFrame,
  RuleEffect,
} from './types'
import { validateExpr } from './logic'

export const ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const VARIABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,40}$/
export const LIMITS = {
  pages: 50,
  blocks: 3000,
  depth: 16,
  text: 20000,
  actions: 20,
  rules: 100,
  expr: 50_000,
  variables: 200,
  sources: 50,
  json: 200_000,
  project: 4_000_000,
}

export const newId = (): string => crypto.randomUUID()

export function emptyVisibility(): Visibility {
  return { variable: '', equals: '', negate: false, hideOn: [] }
}

export function createBlock(
  type: string,
  props: Props = {},
  children?: BlockSpec[],
  name?: string,
): Block {
  const def = definition(type)
  if (!def) throw new Error(`Unknown block type “${type}”.`)
  return {
    id: newId(),
    type,
    name: name ?? def.label,
    props: { ...defaultProps(type), ...props },
    styles: {},
    tabletStyles: {},
    mobileStyles: {},
    actions: [],
    visibility: emptyVisibility(),
    logic: {},
    children: (children ?? def.seed ?? []).map((spec) => fromSpec(spec)),
  }
}

export function fromSpec([type, props, children, name]: BlockSpec): Block {
  return createBlock(
    type,
    props ?? {},
    children ?? (definition(type)?.seed ? undefined : []),
    name,
  )
}

export function createAction(
  trigger: Trigger,
  type: Action['type'],
  target = '',
  value = '',
): Action {
  return { id: newId(), trigger, type, target, value }
}

export const DEFAULT_THEME: ThemeSettings = {
  primary: 'iris',
  tertiary: 'ruby',
  bodyFont: 'Geist',
  headingFont: 'Geist',
  density: 0,
  radius: 'medium',
  mode: 'light',
}

export const DEFAULT_SHELL: ShellSettings = {
  enabled: false,
  layout: 'top',
  title: '',
  icon: 'apps',
  footer: '',
}

export function createPage(
  name: string,
  slug: string,
  blocks: Block[] = [],
): Page {
  return {
    id: newId(),
    name,
    slug,
    title: name,
    icon: 'description',
    inNav: true,
    actions: [],
    rules: [],
    blocks,
  }
}

export function emptyQuery(): QueryFrame {
  return { search: '', searchFields: [], sort: [], limit: 0, select: [] }
}

export function createSource(
  name: string,
  kind: DataSource['kind'],
  patch: Partial<DataSource> = {},
): DataSource {
  return {
    id: newId(),
    name,
    kind,
    json: '[]',
    url: '',
    path: '',
    mode: 'query',
    method: 'GET',
    params: [],
    headers: [],
    body: '',
    query: emptyQuery(),
    autoLoad: true,
    cacheSeconds: 30,
    refreshSeconds: 0,
    ...patch,
  }
}

export function createRule(name = 'New rule'): PageRule {
  return {
    id: newId(),
    name,
    enabled: true,
    when: { kind: 'conditions', group: { combinator: 'and', conditions: [] } },
    effects: [],
    otherwise: [],
  }
}

export function createProject(name = 'Untitled app'): Project {
  return {
    version: 2,
    id: newId(),
    name,
    theme: { ...DEFAULT_THEME },
    shell: { ...DEFAULT_SHELL, title: name },
    pages: [createPage('Home', 'home')],
    variables: [],
    dataSources: [],
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------------------------

export function walk(
  blocks: Block[],
  visit: (block: Block, parent: Block | undefined, depth: number) => void,
  parent?: Block,
  depth = 0,
): void {
  for (const block of blocks) {
    visit(block, parent, depth)
    walk(block.children, visit, block, depth + 1)
  }
}

export function flatten(
  blocks: Block[],
): { block: Block; depth: number; parent?: Block }[] {
  const result: { block: Block; depth: number; parent?: Block }[] = []
  walk(blocks, (block, parent, depth) => result.push({ block, parent, depth }))
  return result
}

export function findBlock(blocks: Block[], id: string): Block | undefined {
  for (const block of blocks) {
    if (block.id === id) return block
    const nested = findBlock(block.children, id)
    if (nested) return nested
  }
  return undefined
}

export function findParent(
  blocks: Block[],
  id: string,
): Block | 'root' | undefined {
  if (blocks.some((block) => block.id === id)) return 'root'
  let found: Block | undefined
  walk(blocks, (block) => {
    if (!found && block.children.some((child) => child.id === id)) found = block
  })
  return found
}

export function removeBlock(blocks: Block[], id: string): Block | undefined {
  const index = blocks.findIndex((block) => block.id === id)
  if (index >= 0) return blocks.splice(index, 1)[0]
  for (const block of blocks) {
    const removed = removeBlock(block.children, id)
    if (removed) return removed
  }
  return undefined
}

/** Inserts `block` under `parentId` ('root' for the page). Returns false when the placement is not allowed. */
export function insertBlock(
  blocks: Block[],
  block: Block,
  parentId: string,
  index?: number,
): boolean {
  const parent = parentId === 'root' ? undefined : findBlock(blocks, parentId)
  if (parentId !== 'root' && !parent) return false
  if (!canContain(parent?.type ?? 'root', block.type)) return false
  const target = parent ? parent.children : blocks
  target.splice(
    Math.min(Math.max(index ?? target.length, 0), target.length),
    0,
    block,
  )
  return true
}

export function moveBlock(
  blocks: Block[],
  id: string,
  parentId: string,
  index: number,
): boolean {
  const block = findBlock(blocks, id)
  if (!block || parentId === id || findBlock(block.children, parentId))
    return false
  const parent = parentId === 'root' ? undefined : findBlock(blocks, parentId)
  if (parentId !== 'root' && !parent) return false
  if (!canContain(parent?.type ?? 'root', block.type)) return false
  removeBlock(blocks, id)
  const target = parent ? parent.children : blocks
  target.splice(Math.min(Math.max(index, 0), target.length), 0, block)
  return true
}

export function duplicateBlock(block: Block): Block {
  return {
    ...structuredClone(block),
    id: newId(),
    actions: block.actions.map((action) => ({ ...action, id: newId() })),
    children: block.children.map(duplicateBlock),
  }
}

export function countBlocks(blocks: Block[]): number {
  let count = 0
  walk(blocks, () => count++)
  return count
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'page'
  )
}

export function uniqueSlug(
  project: Project,
  base: string,
  exceptPageId = '',
): string {
  const root = slugify(base)
  let slug = root
  for (
    let n = 2;
    project.pages.some(
      (page) => page.id !== exceptPageId && page.slug === slug,
    );
    n++
  )
    slug = `${root}-${n}`
  return slug
}

export function uniqueVariableName(project: Project, base: string): string {
  const root =
    base.replace(/[^a-zA-Z0-9_]/g, '').replace(/^[^a-zA-Z_]+/, '') || 'value'
  let name = root
  for (
    let n = 2;
    project.variables.some((variable) => variable.name === name);
    n++
  )
    name = `${root}${n}`
  return name
}

// ---------------------------------------------------------------------------------------------
// Validation & normalisation (used for every import and every load from storage)
// ---------------------------------------------------------------------------------------------

class ProjectError extends Error {}
const fail = (message: string): never => {
  throw new ProjectError(message)
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown, max = LIMITS.text, fallback = ''): string =>
  typeof value === 'string'
    ? value.slice(0, max)
    : typeof value === 'number'
      ? String(value)
      : fallback
const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback
const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(value as T) ? (value as T) : fallback)
const VIEWPORTS: readonly Viewport[] = ['desktop', 'tablet', 'mobile']
const TRIGGERS: readonly Trigger[] = ['click', 'submit', 'change', 'load']

const EXPR_KINDS = ['conditions', 'template', 'rule'] as const
const EFFECTS: readonly EffectKind[] = [
  'show',
  'hide',
  'enable',
  'disable',
  'require',
  'optional',
  'set-prop',
  'set-value',
]

/** Validates an expression's shape, size and operators. Returns undefined when absent. */
function normalizeExpr(input: unknown, where: string): Expr | undefined {
  let value = input as Record<string, unknown>
  if (input === undefined || input === null) return undefined
  if (
    !isObject(value) ||
    !EXPR_KINDS.includes((value as Record<string, unknown>)['kind'] as never)
  )
    fail(`Invalid logic in ${where}.`)
  if (JSON.stringify(value).length > LIMITS.expr)
    fail(`Logic in ${where} is too large.`)
  const kind = value['kind'] as Expr['kind']
  const expr: Expr =
    kind === 'template'
      ? { kind, text: str(value['text'], 5000) }
      : kind === 'rule'
        ? { kind, rule: value['rule'] }
        : { kind, group: normalizeGroup(value['group'], 0, where) }
  const error = validateExpr(expr)
  if (error) fail(`Invalid logic in ${where}: ${error}`)
  return expr
}

function normalizeGroup(
  value: unknown,
  depth: number,
  where: string,
): ConditionGroup {
  if (!isObject(value) || depth > 4) fail(`Invalid conditions in ${where}.`)
  const group = value as Record<string, unknown>
  const items = Array.isArray(group['conditions'])
    ? (group['conditions'] as unknown[]).slice(0, 50)
    : []
  return {
    combinator: group['combinator'] === 'or' ? 'or' : 'and',
    conditions: items.map((entry) => {
      if (!isObject(entry)) fail(`Invalid condition in ${where}.`)
      const item = entry as Record<string, unknown>
      if ('combinator' in item) return normalizeGroup(item, depth + 1, where)
      const condition: Condition = {
        field: str(item['field'], 200),
        operator: oneOf(item['operator'], OPERATORS, 'eq'),
        source: oneOf(
          item['source'],
          ['literal', 'field', 'param'] as const,
          'literal',
        ),
      }
      for (const key of ['value', 'value2'] as const) {
        const raw = item[key]
        if (raw === undefined) continue
        if (raw !== null && typeof raw === 'object')
          fail(`Condition values in ${where} must be plain values.`)
        condition[key] = typeof raw === 'string' ? raw.slice(0, 2000) : raw
      }
      return condition
    }),
  }
}

const OPERATORS: readonly Condition['operator'][] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'contains',
  'not_contains',
  'starts',
  'ends',
  'in',
  'not_in',
  'empty',
  'not_empty',
  'true',
  'false',
]

function normalizeLogic(value: unknown, where: string): BlockLogic {
  if (!isObject(value)) return {}
  const out: BlockLogic = {}
  for (const key of [
    'visible',
    'enabled',
    'required',
    'value',
    'options',
  ] as const) {
    const expr = normalizeExpr(value[key], `${where} (${key})`)
    if (expr) out[key] = expr
  }
  if (isObject(value['props'])) {
    const props: Record<string, Expr> = {}
    for (const [prop, raw] of Object.entries(value['props']).slice(0, 40)) {
      if (!/^[a-zA-Z][\w]{0,40}$/.test(prop)) continue
      const expr = normalizeExpr(raw, `${where} (${prop})`)
      if (expr) props[prop] = expr
    }
    if (Object.keys(props).length) out.props = props
  }
  return out
}

function normalizeEffects(value: unknown, where: string): RuleEffect[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 50).map((entry) => {
    if (!isObject(entry)) fail(`Invalid effect in ${where}.`)
    const raw = entry as Record<string, unknown>
    return {
      id: ID_PATTERN.test(str(raw['id'])) ? str(raw['id']) : newId(),
      target: str(raw['target'], 80),
      kind: oneOf(raw['kind'], EFFECTS, 'show'),
      prop: raw['prop'] === undefined ? undefined : str(raw['prop'], 60),
      value: normalizeExpr(raw['value'], where),
    }
  })
}

function normalizeRules(value: unknown, where: string): PageRule[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > LIMITS.rules)
    fail(`Invalid rules on ${where}.`)
  return (value as unknown[]).map((entry) => {
    if (!isObject(entry)) fail(`Invalid rule on ${where}.`)
    const raw = entry as Record<string, unknown>
    const name = str(raw['name'], 120) || 'Rule'
    return {
      id: ID_PATTERN.test(str(raw['id'])) ? str(raw['id']) : newId(),
      name,
      enabled: bool(raw['enabled'], true),
      when: normalizeExpr(raw['when'], `rule “${name}”`) ?? {
        kind: 'conditions',
        group: { combinator: 'and', conditions: [] },
      },
      effects: normalizeEffects(raw['effects'], `rule “${name}”`),
      otherwise: normalizeEffects(raw['otherwise'], `rule “${name}”`),
    }
  })
}

function normalizePairs(value: unknown): KeyValue[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 30)
    .filter(isObject)
    .map((pair) => ({
      key: str(pair['key'], 100),
      value: str(pair['value'], 2000),
    }))
    .filter((pair) => /^[\w.\-\[\]]{1,100}$/.test(pair.key))
}

function normalizeQueryFrame(value: unknown, where: string): QueryFrame {
  const raw = isObject(value) ? value : {}
  const field = (item: unknown) =>
    typeof item === 'string' && /^[A-Za-z_$][\w$-]*(\.[\w$-]+)*$/.test(item)
  return {
    filter: normalizeExpr(raw['filter'], `${where} filter`),
    search: str(raw['search'], 500),
    searchFields: (Array.isArray(raw['searchFields'])
      ? raw['searchFields']
      : []
    )
      .filter(field)
      .slice(0, 20) as string[],
    sort: (Array.isArray(raw['sort']) ? raw['sort'] : [])
      .filter(
        (item): item is Record<string, unknown> =>
          isObject(item) && field(item['field']),
      )
      .slice(0, 5)
      .map((item) => ({
        field: String(item['field']),
        direction: item['direction'] === 'desc' ? 'desc' : 'asc',
      })),
    limit: Math.min(Math.max(Math.floor(Number(raw['limit']) || 0), 0), 1000),
    select: (Array.isArray(raw['select']) ? raw['select'] : [])
      .filter(field)
      .slice(0, 50) as string[],
    transform: normalizeExpr(raw['transform'], `${where} transform`),
  }
}

function normalizeStyles(value: unknown): StyleMap {
  if (value === undefined) return {}
  if (!isObject(value)) fail('Invalid styles.')
  const styles: StyleMap = {}
  for (const [property, css] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (typeof css !== 'string' || !safeStyle(property, css))
      fail(`Unsupported or unsafe style “${property}”.`)
    styles[property] = css as string
  }
  return styles
}

function normalizeActions(value: unknown): Action[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > LIMITS.actions)
    fail('Invalid actions.')
  return (value as unknown[]).map((raw) => {
    if (
      !isObject(raw) ||
      !ACTION_DEFINITIONS.some((def) => def.type === raw['type'])
    )
      fail('Unknown action.')
    const action = raw as Record<string, unknown>
    return {
      id: ID_PATTERN.test(str(action['id'])) ? str(action['id']) : newId(),
      trigger: oneOf(action['trigger'], TRIGGERS, 'click'),
      type: action['type'] as Action['type'],
      target: str(action['target'], 2000),
      value: str(action['value'], 2000),
      when: normalizeExpr(action['when'], 'an action condition'),
    }
  })
}

function normalizeProps(type: string, value: unknown): Props {
  const defaults = defaultProps(type)
  const props: Props = { ...defaults }
  if (value === undefined) return props
  if (!isObject(value)) fail('Invalid block properties.')
  for (const [key, fallback] of Object.entries(defaults)) {
    const raw = (value as Record<string, unknown>)[key]
    if (raw === undefined) continue
    if (typeof fallback === 'boolean') props[key] = bool(raw, fallback)
    else if (typeof fallback === 'number')
      props[key] = Number.isFinite(Number(raw)) ? Number(raw) : fallback
    else props[key] = str(raw)
  }
  // Options must stay within the allowed set so they can never become arbitrary class names.
  for (const prop of definition(type)?.props ?? []) {
    if (
      prop.options &&
      !prop.options.some((option) => option.value === props[prop.key])
    )
      props[prop.key] = prop.default
  }
  return props
}

function normalizeBlocks(
  value: unknown,
  parentType: string,
  depth: number,
  ids: Set<string>,
  counter: { count: number },
): Block[] {
  if (!Array.isArray(value)) fail('Invalid block list.')
  if (depth > LIMITS.depth) fail('Blocks are nested too deeply.')
  return (value as unknown[]).map((raw) => {
    if (++counter.count > LIMITS.blocks)
      fail(`A project may contain at most ${LIMITS.blocks} blocks.`)
    if (!isObject(raw)) fail('Invalid block.')
    const block = raw as Record<string, unknown>
    const type = str(block['type'])
    const id = str(block['id'])
    if (!definition(type)) fail(`Unknown block type “${type}”.`)
    if (!ID_PATTERN.test(id) || ids.has(id))
      fail('Invalid or duplicate block identifier.')
    if (!canContain(parentType, type))
      fail(
        `A ${type} block cannot be placed inside ${parentType === 'root' ? 'the page' : `a ${parentType}`}.`,
      )
    ids.add(id)
    const children = block['children'] ?? []
    if (!isContainer(type) && Array.isArray(children) && children.length)
      fail('Only layout blocks accept children.')
    const visibility = isObject(block['visibility'])
      ? (block['visibility'] as Record<string, unknown>)
      : {}
    return {
      id,
      type,
      name:
        str(block['name'], 120, definition(type)!.label) ||
        definition(type)!.label,
      props: normalizeProps(type, block['props']),
      styles: normalizeStyles(block['styles']),
      tabletStyles: normalizeStyles(block['tabletStyles']),
      mobileStyles: normalizeStyles(block['mobileStyles']),
      actions: normalizeActions(block['actions']),
      visibility: {
        variable: str(visibility['variable'], 80),
        equals: str(visibility['equals'], 500),
        negate: bool(visibility['negate']),
        hideOn: Array.isArray(visibility['hideOn'])
          ? (visibility['hideOn'] as unknown[]).filter((v): v is Viewport =>
              VIEWPORTS.includes(v as Viewport),
            )
          : [],
      },
      logic: normalizeLogic(
        block['logic'],
        `block “${str(block['name'], 120)}”`,
      ),
      children: isContainer(type)
        ? normalizeBlocks(children, type, depth + 1, ids, counter)
        : [],
    }
  })
}

function normalizeTheme(value: unknown): ThemeSettings {
  const theme = isObject(value) ? value : {}
  return {
    primary: oneOf(theme['primary'], PALETTES, DEFAULT_THEME.primary),
    tertiary: oneOf(theme['tertiary'], PALETTES, DEFAULT_THEME.tertiary),
    bodyFont: oneOf(theme['bodyFont'], FONTS, DEFAULT_THEME.bodyFont),
    headingFont: oneOf(theme['headingFont'], FONTS, DEFAULT_THEME.headingFont),
    density: [0, -1, -2, -3, -4].includes(Number(theme['density']))
      ? Number(theme['density'])
      : 0,
    radius: oneOf(theme['radius'], RADII, DEFAULT_THEME.radius),
    mode: oneOf(theme['mode'], ['light', 'dark', 'system'] as const, 'light'),
  }
}

function normalizeVariables(value: unknown, ids: Set<string>): Variable[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > LIMITS.variables)
    fail('Invalid variables.')
  const names = new Set<string>()
  return (value as unknown[]).map((raw) => {
    if (!isObject(raw)) fail('Invalid variable.')
    const variable = raw as Record<string, unknown>
    const id = str(variable['id'])
    const name = str(variable['name'])
    if (
      !ID_PATTERN.test(id) ||
      ids.has(id) ||
      !VARIABLE_NAME.test(name) ||
      names.has(name)
    )
      fail('Invalid or duplicate variable.')
    ids.add(id)
    names.add(name)
    return {
      id,
      name,
      initial: str(variable['initial'], 5000),
      persist: bool(variable['persist']),
      formula: normalizeExpr(variable['formula'], `variable “${name}”`),
    }
  })
}

function normalizeSources(value: unknown, ids: Set<string>): DataSource[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > LIMITS.sources)
    fail('Invalid data sources.')
  const names = new Set<string>()
  return (value as unknown[]).map((raw) => {
    if (!isObject(raw)) fail('Invalid data source.')
    const source = raw as Record<string, unknown>
    const id = str(source['id'])
    const name = str(source['name'])
    if (
      !ID_PATTERN.test(id) ||
      ids.has(id) ||
      !VARIABLE_NAME.test(name) ||
      names.has(name)
    )
      fail('Invalid or duplicate data source.')
    ids.add(id)
    names.add(name)
    const json = str(source['json'], LIMITS.json, '[]')
    if (json.trim()) {
      try {
        if (!Array.isArray(JSON.parse(json)))
          fail(`Data source “${name}” must contain a JSON array.`)
      } catch (error) {
        if (error instanceof ProjectError) throw error
        fail(`Data source “${name}” contains invalid JSON.`)
      }
    }
    return {
      id,
      name,
      kind: oneOf(
        source['kind'],
        ['static', 'rest', 'collection'] as const,
        'static',
      ),
      json,
      url: str(source['url'], 2000),
      path: str(source['path'], 200),
      mode: oneOf(source['mode'], ['query', 'mutation'] as const, 'query'),
      method: oneOf(
        source['method'],
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const,
        'GET',
      ),
      params: normalizePairs(source['params']),
      headers: normalizePairs(source['headers']),
      body: str(source['body'], 20000),
      query: normalizeQueryFrame(source['query'], `data source “${name}”`),
      autoLoad: bool(source['autoLoad'], true),
      cacheSeconds: Math.min(
        Math.max(Number(source['cacheSeconds']) || 0, 0),
        86400,
      ),
      refreshSeconds: Math.min(
        Math.max(Number(source['refreshSeconds']) || 0, 0),
        86400,
      ),
    }
  })
}

export function normalizeProject(raw: unknown): Project {
  if (!isObject(raw)) fail('Not a builder project.')
  const input = raw as Record<string, unknown>
  if (input['version'] === 1) return normalizeProject(migrateV1(input))
  if (input['version'] !== 2) fail('Unsupported project version.')
  if (
    !Array.isArray(input['pages']) ||
    !(input['pages'] as unknown[]).length ||
    (input['pages'] as unknown[]).length > LIMITS.pages
  )
    fail(`A project needs between 1 and ${LIMITS.pages} pages.`)
  const ids = new Set<string>()
  const counter = { count: 0 }
  const slugs = new Set<string>()
  const variables = normalizeVariables(input['variables'], ids)
  const dataSources = normalizeSources(input['dataSources'], ids)
  const pages = (input['pages'] as unknown[]).map((rawPage) => {
    if (!isObject(rawPage)) fail('Invalid page.')
    const page = rawPage as Record<string, unknown>
    const id = str(page['id'])
    const slug = str(page['slug'])
    if (
      !ID_PATTERN.test(id) ||
      ids.has(id) ||
      !SLUG_PATTERN.test(slug) ||
      slugs.has(slug)
    )
      fail('Invalid or duplicate page.')
    ids.add(id)
    slugs.add(slug)
    const name = str(page['name'], 120) || 'Page'
    return {
      id,
      slug,
      name,
      title: str(page['title'], 200) || name,
      icon: str(page['icon'], 60) || 'description',
      inNav: bool(page['inNav'], true),
      actions: normalizeActions(page['actions']),
      rules: normalizeRules(page['rules'], `page “${name}”`),
      blocks: normalizeBlocks(page['blocks'] ?? [], 'root', 0, ids, counter),
    }
  })
  const shell = isObject(input['shell']) ? input['shell'] : {}
  const id = str(input['id'])
  return {
    version: 2,
    id: ID_PATTERN.test(id) ? id : newId(),
    name: str(input['name'], 200) || 'Untitled app',
    theme: normalizeTheme(input['theme']),
    shell: {
      enabled: bool(shell['enabled']),
      layout: oneOf(shell['layout'], ['top', 'side'] as const, 'top'),
      title: str(shell['title'], 120),
      icon: str(shell['icon'], 60) || 'apps',
      footer: str(shell['footer'], 500),
    },
    pages,
    variables,
    dataSources,
    updatedAt: str(input['updatedAt'], 40) || new Date().toISOString(),
  }
}

export function parseProject(json: string): Project {
  if (json.length > LIMITS.project) fail('Project exceeds the 4 MB limit.')
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    fail('The file is not valid JSON.')
  }
  return normalizeProject(raw)
}

// ---------------------------------------------------------------------------------------------
// Version 1 → 2 migration (projects saved by the first Angular builder)
// ---------------------------------------------------------------------------------------------

function migrateV1Block(raw: Record<string, unknown>): Block[] {
  const s = (key: string) => str(raw[key])
  const children = Array.isArray(raw['children'])
    ? (raw['children'] as Record<string, unknown>[]).flatMap(migrateV1Block)
    : []
  const options = s('options')
  const make = (type: string, props: Props): Block => {
    const block = createBlock(type, props, [])
    block.id = ID_PATTERN.test(s('id')) ? s('id') : block.id
    block.name = s('name') || block.name
    for (const scope of ['styles', 'tabletStyles', 'mobileStyles'] as const) {
      const styles = isObject(raw[scope])
        ? (raw[scope] as Record<string, unknown>)
        : {}
      for (const [property, value] of Object.entries(styles))
        if (typeof value === 'string' && safeStyle(property, value))
          block[scope][property] = value
    }
    block.children = isContainer(type)
      ? children.filter((child) => canContain(type, child.type))
      : []
    return block
  }
  const field = {
    label: s('label'),
    required: raw['required'] === true,
    disabled: raw['disabled'] === true,
  }
  const headingVariant: Record<string, string> = {
    '1': 'headline-lg',
    '2': 'headline-md',
    '3': 'headline-sm',
    '4': 'title-lg',
    '5': 'title-md',
    '6': 'title-sm',
  }
  const panels = (childType: 'tab' | 'panel', key: 'label' | 'title') =>
    options
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [title, body] = line.split('|')
        return createBlock(childType, { [key]: title }, [
          ['text', { text: body || s('text') }],
        ])
      })
  switch (s('type')) {
    case 'section':
    case 'container':
    case 'stack':
    case 'card':
    case 'form':
      return [make(s('type'), {})]
    case 'columns':
      return [
        make('grid', {
          columns: String(raw['columns'] ?? 2),
          tabletColumns: String(raw['columns'] ?? 2),
        }),
      ]
    case 'heading':
      return [
        make('heading', {
          text: s('text'),
          level: s('level') || '2',
          variant: headingVariant[s('level')] ?? 'headline-md',
        }),
      ]
    case 'text':
      return [make('text', { text: s('text') })]
    case 'image':
      return [make('image', { src: s('url'), alt: s('alt') })]
    case 'video':
    case 'audio':
      return [make(s('type'), { src: s('url'), label: s('label') })]
    case 'button':
      return [
        make('button', {
          text: s('text'),
          href: s('url'),
          disabled: field.disabled,
        }),
      ]
    case 'submit':
      return [
        make('button', {
          text: s('text'),
          htmlType: 'submit',
          disabled: field.disabled,
        }),
      ]
    case 'link':
      return [make('link', { text: s('text'), href: s('url') || '#' })]
    case 'icon':
      return [make('icon', { icon: s('text') || 'star', label: s('label') })]
    case 'list':
      return [make('list', { items: options })]
    case 'divider':
      return [make('divider', {})]
    case 'spacer':
      return [make('spacer', {})]
    case 'navigation':
      return [make('nav', { usePages: false, items: options })]
    case 'breadcrumb':
      return [make('breadcrumbs', { items: options })]
    case 'tabs': {
      const block = make('tabs', {})
      block.children = panels('tab', 'label')
      return [block]
    }
    case 'accordion': {
      const block = make('accordion', {})
      block.children = panels('panel', 'title')
      return [block]
    }
    case 'input':
      return [
        make('input', {
          ...field,
          placeholder: s('text'),
          inputType: s('inputType') || 'text',
        }),
      ]
    case 'textarea':
      return [make('textarea', { ...field, placeholder: s('text') })]
    case 'date':
      return [make('datepicker', field)]
    case 'select':
      return [make('select', { ...field, items: options })]
    case 'checkbox':
      return [make('checkbox', field)]
    case 'radio':
      return [make('radio', { ...field, items: options })]
    case 'switch':
      return [make('switch', field)]
    case 'slider':
      return [make('slider', { ...field, value: Number(raw['value']) || 0 })]
    case 'table':
      return [make('table', { items: options })]
    case 'stat':
      return [make('stat', { label: s('label'), value: s('text'), trend: '' })]
    case 'badge':
      return [make('badge', { text: s('text') })]
    case 'progress':
      return [
        make('progress', {
          label: s('label'),
          value: String(raw['value'] ?? 0),
        }),
      ]
    case 'alert':
      return [make('alert', { title: '', text: s('text') })]
    default:
      return children
  }
}

export function migrateV1(raw: Record<string, unknown>): Project {
  const project = createProject(str(raw['name'], 200) || 'Imported website')
  project.theme.mode = raw['dark'] === true ? 'dark' : 'light'
  const pages = Array.isArray(raw['pages'])
    ? (raw['pages'] as Record<string, unknown>[])
    : []
  if (pages.length) {
    project.pages = pages.map((page) => {
      const migrated = createPage(
        str(page['name'], 120) || 'Page',
        SLUG_PATTERN.test(str(page['slug'])) ? str(page['slug']) : 'page',
      )
      if (ID_PATTERN.test(str(page['id']))) migrated.id = str(page['id'])
      migrated.blocks = (
        Array.isArray(page['blocks'])
          ? (page['blocks'] as Record<string, unknown>[])
          : []
      ).flatMap(migrateV1Block)
      return migrated
    })
  }
  return project
}
