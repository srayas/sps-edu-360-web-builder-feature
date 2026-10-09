import {
  Block,
  Page,
  Project,
  fieldName,
  findParent,
  flatten,
  isFormField,
} from '../../../core/model'

export interface PathOption {
  path: string
  label: string
  group:
    | 'Fields'
    | 'Variables'
    | 'Data'
    | 'Row'
    | 'Page'
    | 'Field'
    | 'Response'
    | 'Error'
    | 'Input'
    | 'Steps'
}

/** Everything a binding on `page` can read, for the field pickers in the logic editors. */
export function scopePaths(
  project: Project,
  page: Page,
  rowKeys: (sourceId: string) => string[],
  block?: Block,
): PathOption[] {
  const out: PathOption[] = []
  const blocks = flatten(page.blocks).map((layer) => layer.block)
  for (const field of blocks.filter((item) => isFormField(item.type))) {
    const name = fieldName(field)
    if (!out.some((option) => option.path === `fields.${name}`))
      out.push({
        path: `fields.${name}`,
        label: `${field.name} (${name})`,
        group: 'Fields',
      })
  }
  for (const variable of project.variables)
    out.push({
      path: `vars.${variable.name}`,
      label: variable.formula ? `${variable.name} (computed)` : variable.name,
      group: 'Variables',
    })
  for (const source of project.dataSources.filter(
    (item) => item.mode === 'query',
  )) {
    out.push({
      path: `data.${source.name}`,
      label: `${source.name} (rows)`,
      group: 'Data',
    })
    out.push({
      path: `data.${source.name}.length`,
      label: `${source.name} count`,
      group: 'Data',
    })
    out.push({
      path: `totals.${source.name}`,
      label: `${source.name} total matches`,
      group: 'Data',
    })
  }
  // Inside a repeater, the current row is available as item.*
  let parent = block ? findParent(page.blocks, block.id) : undefined
  while (parent && parent !== 'root') {
    if (parent.type === 'repeater') {
      for (const key of rowKeys(String(parent.props['source'])))
        out.push({ path: `item.${key}`, label: `row ${key}`, group: 'Row' })
      out.push({ path: 'index', label: 'row number (from 0)', group: 'Row' })
      break
    }
    parent = findParent(page.blocks, parent.id)
  }
  out.push(
    { path: 'page.name', label: 'page name', group: 'Page' },
    { path: 'app.name', label: 'app name', group: 'Page' },
  )
  return out
}
