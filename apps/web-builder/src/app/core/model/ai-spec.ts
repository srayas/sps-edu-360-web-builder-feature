/**
 * Page spec: the JSON format an AI assistant (or a person) writes to describe a page — blocks,
 * actions, validation, tables, logic, data sources, functions and workflows — without ids.
 * `checkSpec` validates and repairs it with readable messages, `addSpecToProject` turns it into
 * real blocks, and `pageToSpec` exports an existing page in the same format (round trip).
 */
import {
  ACTION_DEFINITIONS,
  BLOCK_DEFINITIONS,
  PropDef,
  canContain,
  definition,
} from './registry'
import {
  createPage,
  createProject,
  flatten,
  normalizeProject,
  uniqueSlug,
} from './project'
import {
  Template,
  TemplateAction,
  TemplateNode,
  instantiate,
  mergeTemplateData,
  templateAction,
} from './templates'
import { VALIDATION_DEFINITIONS } from './validation'
import { CELL_KINDS, COLUMN_FORMATS } from './table'
import { validateExpr } from './logic'
import { FONTS, PALETTES, RADII } from './types'
import type {
  Action,
  Block,
  DataSource,
  Expr,
  Page,
  Project,
  PropValue,
  TableColumn,
  ThemeSettings,
  Trigger,
  Variable,
} from './types'

export const SPEC_FORMAT = 'web-builder/page@1'

export interface PageSpec {
  format?: string
  /** Page name (also the default page title and URL path). */
  name?: string
  title?: string
  /** URL path segment, e.g. "pricing". */
  path?: string
  icon?: string
  inNav?: boolean
  /** Project theme; applied only when the importer chooses to. */
  theme?: Partial<ThemeSettings>
  blocks: TemplateNode[]
  /** Page-level steps, usually `{ "trigger": "load", … }`. */
  actions?: TemplateAction[]
  sources?: Template['sources']
  variables?: Template['variables']
  functions?: Template['functions']
  workflows?: Template['workflows']
}

export interface SpecIssue {
  level: 'error' | 'warning'
  /** Where in the JSON, e.g. `blocks[0].children[2].props.variant`. */
  path: string
  message: string
}

export interface SpecStats {
  blocks: number
  actions: number
  sources: number
  workflows: number
  functions: number
}

export interface SpecCheck {
  /** The repaired spec (absent when the JSON could not be read at all). */
  spec?: PageSpec
  issues: SpecIssue[]
  stats: SpecStats
}

const TRIGGERS: readonly Trigger[] = [
  'click',
  'submit',
  'change',
  'load',
  'rowClick',
]
const MAX_SPEC = 2_000_000

/** Common names AI tools use for blocks, mapped to the builder's types. */
const ALIASES: Record<string, string> = {
  paragraph: 'text',
  p: 'text',
  label: 'text',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  title: 'heading',
  img: 'image',
  picture: 'image',
  btn: 'button',
  cta: 'button',
  anchor: 'link',
  a: 'link',
  hr: 'divider',
  column: 'stack',
  columns: 'row',
  flex: 'row',
  hstack: 'row',
  vstack: 'stack',
  box: 'stack',
  div: 'stack',
  header: 'toolbar',
  navbar: 'toolbar',
  appbar: 'toolbar',
  navigation: 'nav',
  'text-field': 'input',
  textfield: 'input',
  'text-input': 'input',
  dropdown: 'select',
  combobox: 'autocomplete',
  toggle: 'switch',
  'date-picker': 'datepicker',
  date: 'datepicker',
  'time-picker': 'timepicker',
  upload: 'file',
  'data-table': 'table',
  datatable: 'table',
  modal: 'dialog',
  popup: 'dialog',
  drawer: 'dialog',
  sheet: 'dialog',
  banner: 'alert',
  notice: 'alert',
  metric: 'stat',
  kpi: 'stat',
  tag: 'badge',
  pill: 'badge',
  separator: 'divider',
  'list-item': 'list',
}

/** Reads JSON pasted from an AI reply: strips markdown fences and surrounding prose. */
export function extractJson(text: string): string {
  const fenced = /```(?:json|jsonc)?\s*\n([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1] : text).trim()
  if (body.startsWith('{') || body.startsWith('[')) return body
  const start = body.search(/[[{]/)
  const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'))
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

/** Parses and checks pasted text: a page spec, a list of blocks, one block, or a template. */
export function parseSpec(text: string, project?: Project): SpecCheck {
  const empty: SpecStats = {
    blocks: 0,
    actions: 0,
    sources: 0,
    workflows: 0,
    functions: 0,
  }
  if (!text.trim())
    return {
      issues: [
        {
          level: 'error',
          path: '',
          message: 'Paste the JSON from your AI assistant.',
        },
      ],
      stats: empty,
    }
  if (text.length > MAX_SPEC)
    return {
      issues: [
        { level: 'error', path: '', message: 'The JSON is larger than 2 MB.' },
      ],
      stats: empty,
    }
  const json = extractJson(text)
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (error) {
    return {
      issues: [
        { level: 'error', path: '', message: jsonErrorMessage(json, error) },
      ],
      stats: empty,
    }
  }
  if (isObject(raw) && raw['version'] === 2 && Array.isArray(raw['pages']))
    return {
      issues: [
        {
          level: 'error',
          path: '',
          message:
            'This is a whole project export. Use “Import project JSON” in the menu instead.',
        },
      ],
      stats: empty,
    }
  return checkSpec(raw, project)
}

/** Validates and repairs a spec object. Errors block importing; warnings were repaired. */
export function checkSpec(raw: unknown, project?: Project): SpecCheck {
  const issues: SpecIssue[] = []
  const stats: SpecStats = {
    blocks: 0,
    actions: 0,
    sources: 0,
    workflows: 0,
    functions: 0,
  }
  const input: Record<string, unknown> = Array.isArray(raw)
    ? { blocks: raw }
    : isObject(raw) && typeof raw['type'] === 'string'
      ? { blocks: [raw] }
      : isObject(raw)
        ? { ...raw }
        : {}
  if (!Array.isArray(input['blocks'])) {
    issues.push({
      level: 'error',
      path: 'blocks',
      message:
        'Expected an object with a "blocks" array (or an array of blocks).',
    })
    return { issues, stats }
  }
  const spec = structuredClone(input) as unknown as PageSpec
  const names = new Set<string>()
  const collectNames = (nodes: unknown[]) =>
    nodes.forEach((node) => {
      if (!isObject(node)) return
      if (typeof node['name'] === 'string') names.add(node['name'])
      if (Array.isArray(node['children'])) collectNames(node['children'])
    })
  collectNames(spec.blocks)
  const sourceNames = new Set([
    ...(spec.sources ?? []).map((source) => source?.name),
    ...(project?.dataSources ?? []).map((source) => source.name),
  ])
  const workflowNames = new Set([
    ...(spec.workflows ?? []).map((item) => item?.name),
    ...(project?.workflows ?? []).map((item) => item.name),
  ])
  const variableNames = new Set([
    ...(spec.variables ?? []).map((item) => item?.name),
    ...(project?.variables ?? []).map((item) => item.name),
  ])
  const pageNames = new Set([
    spec.name,
    ...(project?.pages ?? []).map((page) => page.name),
  ])

  const checkRef = (value: unknown, path: string) => {
    if (typeof value !== 'string') return
    const match = /^@(block|source|workflow|variable|page):(.+)$/.exec(value)
    if (!match) return
    const [, kind, name] = match
    const known =
      kind === 'block'
        ? names
        : kind === 'source'
          ? sourceNames
          : kind === 'workflow'
            ? workflowNames
            : kind === 'variable'
              ? variableNames
              : pageNames
    if (kind === 'page' && name === 'first') return
    if (!known.has(name))
      issues.push({
        level: 'warning',
        path,
        message: `“${value}” does not match any ${kind} ${kind === 'block' ? 'name' : ''} in the spec or project; it will be left empty.`,
      })
  }

  const checkExpr = (expr: unknown, path: string): Expr | undefined => {
    const fixed = toExpr(expr)
    if (!fixed) {
      issues.push({
        level: 'warning',
        path,
        message:
          'Not a valid expression ({"kind": "template" | "conditions" | "rule", …}); removed.',
      })
      return undefined
    }
    const error = validateExpr(fixed)
    if (error) {
      issues.push({ level: 'warning', path, message: `${error} Removed.` })
      return undefined
    }
    return fixed
  }

  const checkActions = (
    list: unknown,
    path: string,
    events: readonly Trigger[] | undefined,
    depth = 0,
  ): TemplateAction[] => {
    if (!Array.isArray(list)) return []
    const out: TemplateAction[] = []
    list.forEach((entry, index) => {
      const at = `${path}[${index}]`
      const step: Record<string, unknown> | null = Array.isArray(entry)
        ? {
            trigger: entry[0],
            type: entry[1],
            target: entry[2],
            value: entry[3],
          }
        : isObject(entry)
          ? { ...entry }
          : null
      if (!step) {
        issues.push({
          level: 'warning',
          path: at,
          message: 'A step must be an object; skipped.',
        })
        return
      }
      const def = ACTION_DEFINITIONS.find((item) => item.type === step['type'])
      if (!def) {
        const hint = closest(
          String(step['type'] ?? ''),
          ACTION_DEFINITIONS.map((item) => item.type),
        )
        {
          issues.push({
            level: 'error',
            path: `${at}.type`,
            message: `Unknown step type “${String(step['type'])}”.${hint ? ` Did you mean “${hint}”?` : ''}`,
          })
          return
        }
      }
      if (
        step['trigger'] !== undefined &&
        !TRIGGERS.includes(step['trigger'] as Trigger)
      ) {
        issues.push({
          level: 'warning',
          path: `${at}.trigger`,
          message: `Unknown trigger “${String(step['trigger'])}”; using “${events?.[0] ?? 'click'}”.`,
        })
        step['trigger'] = events?.[0] ?? 'click'
      } else if (
        depth === 0 &&
        step['trigger'] &&
        events &&
        !events.includes(step['trigger'] as Trigger) &&
        step['trigger'] !== 'load'
      ) {
        issues.push({
          level: 'warning',
          path: `${at}.trigger`,
          message: `This block fires ${events.map((item) => `“${item}”`).join(', ')}, not “${String(step['trigger'])}”.`,
        })
      } else if (depth === 0 && !step['trigger'])
        step['trigger'] = events?.[0] ?? 'click'
      for (const key of ['target', 'value'] as const) {
        if (step[key] !== undefined && typeof step[key] !== 'string')
          step[key] =
            typeof step[key] === 'object'
              ? JSON.stringify(step[key])
              : String(step[key])
      }
      checkRef(step['target'], `${at}.target`)
      if (step['options'] !== undefined) {
        if (!isObject(step['options'])) delete step['options']
        else
          step['options'] = Object.fromEntries(
            Object.entries(step['options']).map(([key, value]) => [
              key,
              typeof value === 'string' ? value : JSON.stringify(value),
            ]),
          )
      }
      if (step['expr'] !== undefined) {
        const expr = checkExpr(step['expr'], `${at}.expr`)
        if (expr) step['expr'] = expr
        else delete step['expr']
      }
      for (const key of ['onSuccess', 'onError'] as const)
        if (step[key] !== undefined)
          step[key] = checkActions(step[key], `${at}.${key}`, events, depth + 1)
      if (Array.isArray(step['branches']))
        step['branches'] = (step['branches'] as unknown[]).map((branch, b) =>
          checkActions(branch, `${at}.branches[${b}]`, events, depth + 1),
        )
      stats.actions++
      out.push(step as unknown as TemplateAction)
    })
    return out
  }

  const checkNode = (
    node: unknown,
    path: string,
    parentType: string,
  ): TemplateNode | null => {
    if (!isObject(node)) {
      issues.push({
        level: 'error',
        path,
        message: 'Each block must be an object with a "type".',
      })
      return null
    }
    let type = String(node['type'] ?? '')
    if (!definition(type)) {
      const alias = ALIASES[type.toLowerCase()]
      if (alias) {
        issues.push({
          level: 'warning',
          path: `${path}.type`,
          message: `“${type}” is called “${alias}” here; converted.`,
        })
        type = alias
      } else {
        const hint = closest(
          type,
          BLOCK_DEFINITIONS.map((item) => item.type),
        )
        issues.push({
          level: 'error',
          path: `${path}.type`,
          message: `Unknown block type “${type}”.${hint ? ` Did you mean “${hint}”?` : ''}`,
        })
        return null
      }
    }
    const def = definition(type)!
    if (!canContain(parentType, type)) {
      const where =
        parentType === 'root'
          ? 'at the top level of a page'
          : `inside “${parentType}”`
      issues.push({
        level: 'error',
        path,
        message: `A “${type}” block cannot be placed ${where}.${def.parents ? ` It belongs inside ${def.parents.map((item) => `“${item}”`).join(' or ')}.` : ''}`,
      })
      return null
    }
    stats.blocks++
    const out: TemplateNode = { type }
    if (typeof node['name'] === 'string' && node['name'].trim())
      out.name = node['name'].trim().slice(0, 120)
    // Props: keep known keys, coerce simple types, fix select values.
    const props: Record<string, PropValue> = {}
    if (node['props'] !== undefined && !isObject(node['props']))
      issues.push({
        level: 'warning',
        path: `${path}.props`,
        message: '"props" must be an object; ignored.',
      })
    for (const [key, value] of Object.entries(
      isObject(node['props']) ? node['props'] : {},
    )) {
      const prop = def.props.find((item) => item.key === key)
      if (!prop) {
        issues.push({
          level: 'warning',
          path: `${path}.props.${key}`,
          message: `“${type}” has no “${key}” property; ignored.${propHint(key, def.props)}`,
        })
        continue
      }
      const fixed = coerceProp(prop, value)
      if (fixed.message)
        issues.push({
          level: 'warning',
          path: `${path}.props.${key}`,
          message: fixed.message,
        })
      if (fixed.value !== undefined) props[key] = fixed.value
      checkRef(fixed.value, `${path}.props.${key}`)
    }
    // Sample content defaults (e.g. a stat's "+12% this month") would leak into AI pages: content
    // the spec leaves out stays empty.
    for (const prop of def.props)
      if (
        !(prop.key in props) &&
        prop.section === 'content' &&
        ['text', 'textarea', 'media', 'items'].includes(prop.kind) &&
        prop.default !== ''
      )
        props[prop.key] = ''
    if (Object.keys(props).length) out.props = props
    // Children.
    const children = node['children']
    if (Array.isArray(children) && children.length) {
      if (!def.container)
        issues.push({
          level: 'error',
          path: `${path}.children`,
          message: `“${type}” cannot have children.`,
        })
      else
        out.children = children
          .map((child, index) =>
            checkNode(child, `${path}.children[${index}]`, type),
          )
          .filter((child): child is TemplateNode => !!child)
    }
    if (node['actions'] !== undefined) {
      const actions = checkActions(
        node['actions'],
        `${path}.actions`,
        def.events,
      )
      if (actions.length) out.actions = actions
    }
    if (Array.isArray(node['validations'])) {
      const rules = (node['validations'] as unknown[]).flatMap(
        (rule, index) => {
          if (
            !isObject(rule) ||
            !VALIDATION_DEFINITIONS.some((item) => item.kind === rule['kind'])
          ) {
            issues.push({
              level: 'warning',
              path: `${path}.validations[${index}]`,
              message: `Unknown validation kind “${isObject(rule) ? String(rule['kind']) : ''}”; skipped.`,
            })
            return []
          }
          const fixed: Record<string, unknown> = {
            ...rule,
            ...(rule['value'] !== undefined
              ? { value: String(rule['value']) }
              : {}),
          }
          for (const key of ['when', 'expr'] as const) {
            if (fixed[key] === undefined) continue
            const expr = checkExpr(
              fixed[key],
              `${path}.validations[${index}].${key}`,
            )
            if (expr) fixed[key] = expr
            else delete fixed[key]
          }
          return [fixed]
        },
      )
      if (rules.length) out.validations = rules as TemplateNode['validations']
    }
    if (isObject(node['logic'])) {
      const logic: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(node['logic'])) {
        if (key === 'props' && isObject(value)) {
          const props: Record<string, Expr> = {}
          for (const [prop, expr] of Object.entries(value)) {
            const fixed = checkExpr(expr, `${path}.logic.props.${prop}`)
            if (fixed) props[prop] = fixed
          }
          if (Object.keys(props).length) logic['props'] = props
        } else if (
          ['visible', 'enabled', 'required', 'value', 'options'].includes(key)
        ) {
          const fixed = checkExpr(value, `${path}.logic.${key}`)
          if (fixed) logic[key] = fixed
        } else
          issues.push({
            level: 'warning',
            path: `${path}.logic.${key}`,
            message: `Unknown logic “${key}”; ignored.`,
          })
      }
      if (Object.keys(logic).length) out.logic = logic
    }
    if (type === 'table' && isObject(node['table']))
      out.table = checkTable(
        node['table'],
        `${path}.table`,
      ) as TemplateNode['table']
    if (isObject(node['styles']))
      out.styles = node['styles'] as Record<string, string>
    return out
  }

  const checkTable = (table: Record<string, unknown>, path: string) => {
    const columns = (
      Array.isArray(table['columns']) ? table['columns'] : []
    ).flatMap((column: unknown, index) => {
      if (!isObject(column)) return []
      const at = `${path}.columns[${index}]`
      const out: Record<string, unknown> = {
        ...column,
        id:
          typeof column['id'] === 'string' && column['id']
            ? column['id']
            : `c${index + 1}`,
        field: String(column['field'] ?? ''),
        header: String(
          column['header'] ?? column['field'] ?? `Column ${index + 1}`,
        ),
        format: COLUMN_FORMATS.some((item) => item.value === column['format'])
          ? column['format']
          : 'text',
        align: ['start', 'center', 'end'].includes(String(column['align']))
          ? column['align']
          : 'start',
        sortable: column['sortable'] !== false,
      }
      if (column['format'] !== undefined && out['format'] !== column['format'])
        issues.push({
          level: 'warning',
          path: `${at}.format`,
          message: `Unknown format “${String(column['format'])}”; using text. Formats: ${COLUMN_FORMATS.map((item) => item.value).join(', ')}.`,
        })
      if (
        column['cell'] !== undefined &&
        !CELL_KINDS.some((item) => item.value === column['cell'])
      ) {
        issues.push({
          level: 'warning',
          path: `${at}.cell`,
          message: `Unknown cell type “${String(column['cell'])}”; using display.`,
        })
        delete out['cell']
      }
      for (const key of [
        'value',
        'visible',
        'optionsExpr',
        'cellWhen',
      ] as const) {
        if (column[key] === undefined) continue
        const expr = checkExpr(column[key], `${at}.${key}`)
        if (expr) out[key] = expr
        else delete out[key]
      }
      if (Array.isArray(column['tones']))
        out['tones'] = (column['tones'] as Record<string, unknown>[])
          .map((rule, t) => ({
            id: `t${t + 1}`,
            ...rule,
            when: checkExpr(rule?.['when'], `${at}.tones[${t}].when`),
          }))
          .filter((rule) => rule.when)
      if (Array.isArray(column['validations']))
        out['validations'] = (
          column['validations'] as Record<string, unknown>[]
        ).map((rule, v) => ({
          id: `v${v + 1}`,
          ...rule,
          ...(rule?.['value'] !== undefined
            ? { value: String(rule['value']) }
            : {}),
        }))
      if (column['onChange'] !== undefined)
        out['onChange'] = checkActions(column['onChange'], `${at}.onChange`, [
          'change',
        ])
      if (
        typeof column['cellBlock'] === 'string' &&
        !column['cellBlock'].startsWith('@block:')
      )
        out['cellBlock'] = `@block:${column['cellBlock']}`
      return [out]
    })
    const ids = new Set(columns.map((column) => column['id']))
    const rowActions = (
      Array.isArray(table['rowActions']) ? table['rowActions'] : []
    ).flatMap((action: unknown, index) => {
      if (!isObject(action)) return []
      return [
        {
          id: `a${index + 1}`,
          label: String(action['label'] ?? 'Action'),
          icon: String(action['icon'] ?? 'bolt'),
          display: action['display'] === 'text' ? 'text' : 'icon',
          ...(action['danger'] ? { danger: true } : {}),
          ...(action['visible']
            ? {
                visible: checkExpr(
                  action['visible'],
                  `${path}.rowActions[${index}].visible`,
                ),
              }
            : {}),
          actions: checkActions(
            action['actions'],
            `${path}.rowActions[${index}].actions`,
            ['click'],
          ),
        },
      ]
    })
    const merges = (Array.isArray(table['merges']) ? table['merges'] : [])
      .filter((merge: unknown) => isObject(merge) && ids.has(merge['column']))
      .map((merge, index) => ({
        id: `m${index + 1}`,
        colspan: 1,
        rowspan: 1,
        ...(merge as object),
      }))
    const headerGroups = (
      Array.isArray(table['headerGroups']) ? table['headerGroups'] : []
    )
      .filter((group: unknown) => isObject(group) && ids.has(group['column']))
      .map((group, index) => ({
        id: `g${index + 1}`,
        span: 1,
        label: '',
        ...(group as object),
      }))
    return {
      columns,
      rowActions,
      merges,
      headerGroups,
      ...(Array.isArray(table['rowTones'])
        ? {
            rowTones: (table['rowTones'] as Record<string, unknown>[])
              .map((rule) => ({
                tone: rule?.['tone'],
                when: checkExpr(rule?.['when'], `${path}.rowTones`),
              }))
              .filter((rule) => rule.when),
          }
        : {}),
      ...(typeof table['emptyText'] === 'string'
        ? { emptyText: table['emptyText'] }
        : {}),
    }
  }

  spec.blocks = (input['blocks'] as unknown[])
    .map((node, index) => checkNode(node, `blocks[${index}]`, 'root'))
    .filter((node): node is TemplateNode => !!node)
  if (!spec.blocks.length && !issues.some((issue) => issue.level === 'error'))
    issues.push({
      level: 'error',
      path: 'blocks',
      message: 'The spec has no blocks.',
    })
  if (spec.actions !== undefined)
    spec.actions = checkActions(spec.actions, 'actions', ['load'])

  spec.sources = (
    Array.isArray(input['sources']) ? input['sources'] : []
  ).flatMap((source: unknown, index) => {
    if (
      !isObject(source) ||
      typeof source['name'] !== 'string' ||
      !/^\w+$/.test(source['name'])
    ) {
      issues.push({
        level: 'warning',
        path: `sources[${index}]`,
        message:
          'A data source needs a "name" made of letters, digits or _; skipped.',
      })
      return []
    }
    const kind = ['static', 'rest', 'collection'].includes(
      String(source['kind']),
    )
      ? source['kind']
      : source['url']
        ? 'rest'
        : 'static'
    const json =
      source['json'] === undefined
        ? undefined
        : typeof source['json'] === 'string'
          ? source['json']
          : JSON.stringify(source['json'], null, 2)
    stats.sources++
    return [
      {
        ...source,
        kind,
        ...(json !== undefined ? { json } : {}),
      } as NonNullable<PageSpec['sources']>[number],
    ]
  })
  spec.variables = (
    Array.isArray(input['variables']) ? input['variables'] : []
  ).flatMap((variable: unknown, index) => {
    if (!isObject(variable) || typeof variable['name'] !== 'string') {
      issues.push({
        level: 'warning',
        path: `variables[${index}]`,
        message: 'A variable needs a "name"; skipped.',
      })
      return []
    }
    return [
      {
        persist: false,
        ...variable,
        initial: String(variable['initial'] ?? ''),
      } as NonNullable<PageSpec['variables']>[number],
    ]
  })
  spec.functions = (
    Array.isArray(input['functions']) ? input['functions'] : []
  ).flatMap((fn: unknown, index) => {
    const body = isObject(fn)
      ? checkExpr(fn['body'], `functions[${index}].body`)
      : undefined
    if (!isObject(fn) || typeof fn['name'] !== 'string' || !body) return []
    stats.functions++
    return [
      { params: [], ...fn, body } as unknown as NonNullable<
        PageSpec['functions']
      >[number],
    ]
  })
  spec.workflows = (
    Array.isArray(input['workflows']) ? input['workflows'] : []
  ).flatMap((workflow: unknown, index) => {
    if (!isObject(workflow) || typeof workflow['name'] !== 'string') return []
    stats.workflows++
    const output =
      workflow['output'] !== undefined
        ? checkExpr(workflow['output'], `workflows[${index}].output`)
        : undefined
    return [
      {
        params: [],
        ...workflow,
        steps: checkActions(workflow['steps'], `workflows[${index}].steps`, [
          'click',
        ]),
        ...(output ? { output } : {}),
      } as unknown as NonNullable<PageSpec['workflows']>[number],
    ]
  })
  if (spec.theme !== undefined) spec.theme = checkTheme(spec.theme, issues)

  // Final check: build the page in a scratch project and run the same validation as loading.
  if (!issues.some((issue) => issue.level === 'error')) {
    try {
      const scratch = structuredClone(project ?? emptyProject())
      addSpecToProject(scratch, spec, 'new')
      normalizeProject(JSON.parse(JSON.stringify(scratch)))
    } catch (error) {
      issues.push({
        level: 'error',
        path: '',
        message:
          error instanceof Error
            ? error.message
            : 'The page could not be built.',
      })
    }
  }
  return { spec, issues, stats }
}

export type SpecMode = 'new' | 'append' | 'replace'

/**
 * Adds a checked spec to a project (mutating it): as a new page, appended to `pageId`, or
 * replacing that page's blocks. Returns the page that received the blocks.
 */
export function addSpecToProject(
  project: Project,
  spec: PageSpec,
  mode: SpecMode,
  pageId?: string,
  applyTheme = false,
): Page {
  const template: Template = {
    id: 'spec',
    name: spec.name || 'Imported page',
    icon: 'description',
    description: '',
    kind: 'page',
    blocks: spec.blocks,
    sources: spec.sources,
    variables: spec.variables,
    functions: spec.functions,
    workflows: spec.workflows,
  }
  let page =
    mode === 'new'
      ? undefined
      : project.pages.find((item) => item.id === pageId)
  if (!page) {
    const name = (spec.name || 'Imported page').slice(0, 80)
    page = createPage(name, uniqueSlug(project, spec.path || name))
    page.title = spec.title || name
    if (spec.icon) page.icon = spec.icon
    if (spec.inNav === false) page.inNav = false
    project.pages.push(page)
  }
  const refs = mergeTemplateData(project, template)
  refs.pages = { ...refs.pages, [page.name]: page.id }
  const blocks = instantiate(spec.blocks, refs)
  page.blocks = mode === 'append' ? [...page.blocks, ...blocks] : blocks
  if (spec.actions?.length)
    page.actions = [
      ...(mode === 'append' ? page.actions : []),
      ...spec.actions.map((step) => templateAction(step, 'load', refs)),
    ]
  if (applyTheme && spec.theme)
    project.theme = { ...project.theme, ...spec.theme }
  return page
}

// ---------------------------------------------------------------------------------------------
// Export: page → spec (ids become @references)
// ---------------------------------------------------------------------------------------------

export function pageToSpec(project: Project, page: Page): PageSpec {
  const blocks = flatten(page.blocks).map((layer) => layer.block)
  const nameOf = (id: string) => blocks.find((block) => block.id === id)?.name
  const source = (id: string) =>
    project.dataSources.find((item) => item.id === id)?.name
  const ref = (kind: string, value: string): string => {
    if (!value) return value
    switch (kind) {
      case 'dialog':
      case 'block': {
        const name = nameOf(value)
        return name ? `@block:${name}` : value
      }
      case 'source':
      case 'collection':
      case 'mutation': {
        const name = source(value)
        return name ? `@source:${name}` : value
      }
      case 'page': {
        const name = project.pages.find((item) => item.id === value)?.name
        return name ? `@page:${name}` : value
      }
      case 'variable': {
        const name = project.variables.find((item) => item.id === value)?.name
        return name ? `@variable:${name}` : value
      }
      case 'workflow': {
        const name = (project.workflows ?? []).find(
          (item) => item.id === value,
        )?.name
        return name ? `@workflow:${name}` : value
      }
      default:
        return value
    }
  }
  const step = (action: Action, inheritedTrigger?: Trigger): TemplateAction => {
    const def = ACTION_DEFINITIONS.find((item) => item.type === action.type)
    return clean({
      trigger: action.trigger !== inheritedTrigger ? action.trigger : undefined,
      type: action.type,
      target: ref(def?.target ?? 'none', action.target) || undefined,
      value: action.value || undefined,
      options: action.options,
      expr: action.expr,
      onSuccess: action.onSuccess?.map((child) => step(child, action.trigger)),
      onError: action.onError?.map((child) => step(child, action.trigger)),
      branches: action.branches?.map((branch) =>
        branch.map((child) => step(child, action.trigger)),
      ),
    })
  }
  const node = (block: Block): TemplateNode => {
    const def = definition(block.type)
    const props: Record<string, PropValue> = {}
    for (const prop of def?.props ?? []) {
      const value = block.props[prop.key]
      const content =
        prop.section === 'content' &&
        ['text', 'textarea', 'media', 'items'].includes(prop.kind)
      // Content is always written out: on import, missing content stays empty.
      if (
        value === undefined ||
        (value === prop.default && !(content && value !== ''))
      )
        continue
      props[prop.key] =
        typeof value === 'string' &&
        ['source', 'page', 'variable'].includes(prop.kind)
          ? ref(prop.kind, value)
          : value
    }
    const table = block.table
      ? clean({
          columns: block.table.columns.map(
            (column) =>
              clean({
                ...column,
                onChange: column.onChange?.map((child) =>
                  step(child, 'change'),
                ),
                cellBlock: column.cellBlock
                  ? `@block:${nameOf(column.cellBlock) ?? ''}`
                  : undefined,
              }) as TableColumn,
          ),
          rowActions: block.table.rowActions.map((action) => ({
            ...action,
            actions: action.actions.map((child) => step(child)),
          })),
          merges: block.table.merges,
          headerGroups: block.table.headerGroups,
          rowTones: block.table.rowTones?.map(({ id: _id, ...rule }) => rule),
          emptyText: block.table.emptyText,
        })
      : undefined
    return clean({
      type: block.type,
      name: block.name !== def?.label ? block.name : undefined,
      props: Object.keys(props).length ? props : undefined,
      children: block.children.length ? block.children.map(node) : undefined,
      actions: block.actions.length
        ? block.actions.map((action) => step(action))
        : undefined,
      validations: block.validations?.map(({ id: _id, ...rule }) => rule),
      table: table as TemplateNode['table'],
      logic: Object.keys(block.logic ?? {}).length ? block.logic : undefined,
      styles: Object.keys(block.styles).length ? block.styles : undefined,
      tabletStyles: Object.keys(block.tabletStyles).length
        ? block.tabletStyles
        : undefined,
    })
  }
  const withoutId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest
  return clean({
    format: SPEC_FORMAT,
    name: page.name,
    title: page.title !== page.name ? page.title : undefined,
    path: page.slug,
    icon: page.icon !== 'description' ? page.icon : undefined,
    inNav: page.inNav ? undefined : false,
    theme: project.theme,
    blocks: page.blocks.map(node),
    actions: page.actions.length
      ? page.actions.map((action) => step(action))
      : undefined,
    sources: project.dataSources.length
      ? project.dataSources.map((item) => withoutId(item as DataSource))
      : undefined,
    variables: project.variables.length
      ? project.variables.map((item) => withoutId(item as Variable))
      : undefined,
    functions: project.functions?.length
      ? project.functions.map(withoutId)
      : undefined,
    workflows: project.workflows?.length
      ? project.workflows.map((workflow) => ({
          ...withoutId(workflow),
          steps: workflow.steps.map((child) => step(child)),
        }))
      : undefined,
  }) as PageSpec
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Drops undefined keys so exported JSON stays small. */
function clean<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T
}

function emptyProject(): Project {
  return createProject('Scratch')
}

/** Accepts full expressions plus shorthands: "text {{x}}" → template, JSON Logic object → rule. */
function toExpr(value: unknown): Expr | undefined {
  if (typeof value === 'string') return { kind: 'template', text: value }
  if (typeof value === 'boolean' || typeof value === 'number')
    return { kind: 'rule', rule: value }
  if (!isObject(value)) return undefined
  if (value['kind'] === 'template' && typeof value['text'] === 'string')
    return { kind: 'template', text: value['text'] }
  if (value['kind'] === 'rule' && 'rule' in value)
    return { kind: 'rule', rule: value['rule'] }
  if (value['kind'] === 'conditions' && isObject(value['group']))
    return value as unknown as Expr
  if (!('kind' in value)) return { kind: 'rule', rule: value }
  return undefined
}

function coerceProp(
  prop: PropDef,
  value: unknown,
): { value?: PropValue; message?: string } {
  if (value === null || value === undefined) return {}
  switch (prop.kind) {
    case 'toggle':
      return typeof value === 'boolean'
        ? { value }
        : {
            value: value === 'true' || value === 1 || value === '1',
            message: 'Expected true/false; converted.',
          }
    case 'number': {
      const number = Number(value)
      if (typeof value === 'number') return { value }
      return Number.isFinite(number)
        ? { value: number }
        : { message: `Expected a number, got “${String(value)}”; ignored.` }
    }
    case 'select': {
      const text = String(value)
      const options = prop.options ?? []
      if (options.some((option) => option.value === text))
        return { value: text }
      const byLabel = options.find(
        (option) => option.label.toLowerCase() === text.toLowerCase(),
      )
      if (byLabel) return { value: byLabel.value }
      return {
        value: undefined,
        message: `“${text}” is not an option. Use one of: ${options.map((option) => option.value).join(', ')}. Default kept.`,
      }
    }
    case 'items':
      if (Array.isArray(value))
        return {
          value: value
            .map((line) =>
              Array.isArray(line)
                ? line.map(String).join('|')
                : isObject(line)
                  ? Object.values(line).map(String).join('|')
                  : String(line),
            )
            .join('\n'),
        }
      return { value: String(value) }
    default:
      return typeof value === 'string'
        ? { value }
        : {
            value:
              typeof value === 'object' ? JSON.stringify(value) : String(value),
          }
  }
}

function propHint(key: string, props: readonly PropDef[]): string {
  const hint = closest(
    key,
    props.map((prop) => prop.key),
  )
  return hint ? ` Did you mean “${hint}”?` : ''
}

function checkTheme(
  theme: unknown,
  issues: SpecIssue[],
): Partial<ThemeSettings> | undefined {
  if (!isObject(theme)) return undefined
  const out: Partial<ThemeSettings> = {}
  const pick = <T extends string>(
    key: keyof ThemeSettings,
    list: readonly T[],
  ) => {
    const value = theme[key]
    if (value === undefined) return
    if (list.includes(value as T)) (out as Record<string, unknown>)[key] = value
    else
      issues.push({
        level: 'warning',
        path: `theme.${key}`,
        message: `“${String(value)}” is not available. Choose: ${list.join(', ')}.`,
      })
  }
  pick('primary', PALETTES)
  pick('tertiary', PALETTES)
  pick('bodyFont', FONTS)
  pick('headingFont', FONTS)
  pick('radius', RADII)
  pick('mode', ['light', 'dark', 'system'] as const)
  if (typeof theme['density'] === 'number')
    out.density = Math.max(-4, Math.min(0, Math.round(theme['density'])))
  return out
}

/** Nearest name by edit distance (for "did you mean" hints). */
function closest(word: string, candidates: readonly string[]): string {
  const target = word.toLowerCase()
  let best = ''
  let score = Infinity
  for (const candidate of candidates) {
    const distance = levenshtein(target, candidate.toLowerCase())
    if (distance < score) {
      score = distance
      best = candidate
    }
  }
  if (score <= Math.max(2, Math.floor(target.length / 3))) return best
  // "statistic" → "stat", "img-block" → "image": a candidate that starts the word (or vice versa).
  return (
    candidates.find(
      (candidate) =>
        target.length > 2 &&
        (target.startsWith(candidate.toLowerCase()) ||
          candidate.toLowerCase().startsWith(target)),
    ) ?? ''
  )
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[b.length]
}

function jsonErrorMessage(json: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Invalid JSON.'
  const position = /position (\d+)/.exec(message)
  if (!position) return `Not valid JSON: ${message}`
  const index = Number(position[1])
  const before = json.slice(0, index)
  const line = before.split('\n').length
  const column = index - before.lastIndexOf('\n')
  return `Not valid JSON at line ${line}, column ${column}: ${message.replace(/ in JSON at position \d+.*$/, '')}.`
}
