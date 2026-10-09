import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  EXAMPLE_SPEC,
  TEMPLATES,
  addSpecToProject,
  aiPrompt,
  checkSpec,
  createProject,
  extractJson,
  flatten,
  instantiate,
  mergeTemplateData,
  normalizeProject,
  pageToSpec,
  parseSpec,
  specSchema,
} from './index'

test('the prompt example is a valid spec with no warnings', () => {
  const result = checkSpec(structuredClone(EXAMPLE_SPEC))
  assert.deepEqual(result.issues, [])
  assert.ok(result.stats.blocks > 15)
  const project = createProject('Demo')
  const page = addSpecToProject(project, result.spec!, 'new')
  const loaded = normalizeProject(JSON.parse(JSON.stringify(project)))
  const blocks = flatten(
    loaded.pages.find((item) => item.id === page.id)!.blocks,
  ).map((entry) => entry.block)
  const form = blocks.find((block) => block.type === 'form')!
  const dialog = blocks.find((block) => block.name === 'Thanks')!
  assert.equal(
    form.actions[0].onSuccess?.[0].target,
    dialog.id,
    '@block: references resolve to block ids',
  )
  assert.equal(
    blocks.find((block) => block.props['field'] === 'email')?.validations?.[0]
      .kind,
    'email',
  )
  assert.equal(
    blocks.find(
      (block) => block.type === 'button' && block.props['text'] === 'Sign in',
    )?.actions[0].target,
    loaded.pages[0].id,
  )
})

test('AI replies are read with fences, aliases and typed coercions; mistakes are explained', () => {
  const reply =
    'Here is your page:\n```json\n{"name":"Hi","blocks":[{"type":"paragraph","props":{"text":"Hello","colour":"red"}},{"type":"section","props":{"padding":"huge","outlined":"true"},"children":[{"type":"buton"}]}]}\n```\nEnjoy!'
  assert.ok(extractJson(reply).startsWith('{"name"'))
  const result = parseSpec(reply)
  const messages = result.issues.map(
    (issue) => `${issue.level} ${issue.path}: ${issue.message}`,
  )
  assert.ok(
    messages.some((m) => m.includes('“paragraph” is called “text”')),
    messages.join('\n'),
  )
  assert.ok(
    messages.some((m) => m.startsWith('warning blocks[0].props.colour')),
  )
  assert.ok(messages.some((m) => m.includes('“huge” is not an option')))
  assert.ok(
    messages.some(
      (m) =>
        m.startsWith('error blocks[1].children[0].type') &&
        m.includes('Did you mean “button”'),
    ),
  )
  assert.equal(result.spec!.blocks[1].props!['outlined'], true)
  assert.match(parseSpec('{"blocks": [}').issues[0].message, /^Not valid JSON/)
  assert.match(
    parseSpec('[{"type":"tab"}]').issues[0].message,
    /cannot be placed at the top level/,
  )
})

test('a page exported as a spec rebuilds the same page (round trip)', () => {
  const template = TEMPLATES.find((item) => item.id === 'page-orders')!
  const project = createProject('Orders')
  const refs = mergeTemplateData(project, template)
  project.pages[0].blocks = instantiate(template.blocks, refs)
  const spec = pageToSpec(project, project.pages[0])
  const json = JSON.stringify(spec)
  assert.ok(
    !json.includes(project.dataSources[0].id),
    'source ids become @source: names',
  )
  const result = parseSpec(json, project)
  assert.deepEqual(
    result.issues.filter((issue) => issue.level === 'error'),
    [],
  )
  const copy = createProject('Copy')
  const page = addSpecToProject(copy, result.spec!, 'replace', copy.pages[0].id)
  const before = flatten(project.pages[0].blocks).map((entry) => entry.block)
  const after = flatten(page.blocks).map((entry) => entry.block)
  assert.equal(after.length, before.length)
  const content = (blocks: typeof before) =>
    blocks.map((block) => [
      block.type,
      block.name,
      block.props['text'] ?? block.props['title'] ?? block.props['label'] ?? '',
      block.props['items'] ?? '',
    ])
  assert.deepEqual(
    content(after),
    content(before),
    'types, names and content survive the round trip',
  )
  const table = after.find((block) => block.type === 'table')!
  assert.equal(table.table!.columns.length, 11)
  assert.equal(table.props['source'], copy.dataSources[0].id)
  const followUp = table.table!.columns.find(
    (column) => column.header === 'Follow-up',
  )!
  assert.equal(
    table.children.find((child) => child.id === followUp.cellBlock)?.type,
    'table-cell',
  )
  const edit = after.find((block) => block.name === 'Edit order')!
  assert.equal(table.table!.rowActions[1].actions[0].target, edit.id)
})

test('prompt and schema list every block type', () => {
  const prompt = aiPrompt()
  for (const type of ['section', 'table', 'dialog', 'datepicker', 'workflow'])
    assert.ok(prompt.includes(type), type)
  const schema = specSchema() as {
    $defs: { node: { properties: { type: { enum: string[] } } } }
  }
  assert.ok(schema.$defs.node.properties.type.enum.includes('table-cell'))
})

test('the AI kit in docs/ai is generated from the current registry and its examples are valid', async () => {
  const { readFileSync } = await import('node:fs')
  const prompt = readFileSync('../../docs/ai/PROMPT.md', 'utf8')
  assert.equal(
    prompt,
    aiPrompt().endsWith('\n') ? aiPrompt() : `${aiPrompt()}\n`,
    'docs/ai/PROMPT.md is stale: run `pnpm --filter @spsedu360/web-builder ai:docs`',
  )
  for (const file of ['contact', 'team-dashboard']) {
    const result = parseSpec(
      readFileSync(`../../docs/ai/examples/${file}.page.json`, 'utf8'),
    )
    assert.deepEqual(result.issues, [], file)
  }
})
