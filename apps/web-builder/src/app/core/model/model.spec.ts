import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  BLOCK_DEFINITIONS,
  TEMPLATES,
  blockClasses,
  blockCss,
  canContain,
  createBlock,
  createProject,
  definition,
  duplicateBlock,
  exportPage,
  findBlock,
  flatten,
  instantiate,
  interpolate,
  lookup,
  moveBlock,
  normalizeProject,
  parseProject,
  safeStyle,
  safeUrl,
  safeCssUrl,
  siteThemeClasses,
  insertBlock,
  truthy,
  fieldKey,
  safeEndpoint,
} from './index'

test('registry entries are internally consistent', () => {
  const types = new Set<string>()
  for (const def of BLOCK_DEFINITIONS) {
    assert.ok(!types.has(def.type), `duplicate type ${def.type}`)
    types.add(def.type)
    const keys = def.props.map((prop) => prop.key)
    assert.equal(
      new Set(keys).size,
      keys.length,
      `duplicate prop keys in ${def.type}`,
    )
    for (const prop of def.props) {
      if (prop.options)
        assert.ok(
          prop.options.some((option) => option.value === prop.default),
          `${def.type}.${prop.key} default not in options`,
        )
    }
    const block = createBlock(def.type)
    for (const child of block.children)
      assert.ok(
        canContain(def.type, child.type),
        `${def.type} seed child ${child.type} not allowed`,
      )
  }
  assert.ok(BLOCK_DEFINITIONS.length >= 50, 'expected a complete block library')
})

test('placement rules keep tabs, steps and dialogs where they belong', () => {
  assert.equal(canContain('tabs', 'tab'), true)
  assert.equal(canContain('tabs', 'text'), false)
  assert.equal(canContain('root', 'tab'), false)
  assert.equal(canContain('section', 'step'), false)
  assert.equal(canContain('root', 'dialog'), true)
  assert.equal(canContain('section', 'dialog'), false)
  assert.equal(canContain('text', 'text'), false)
  const blocks = [createBlock('section')]
  assert.equal(insertBlock(blocks, createBlock('tab'), blocks[0].id), false)
  assert.equal(
    insertBlock(blocks, createBlock('heading'), blocks[0].id, 0),
    true,
  )
  assert.equal(blocks[0].children[0].type, 'heading')
})

test('nested moves preserve children and reject cycles', () => {
  const parent = createBlock('container')
  const child = createBlock('card', {}, [])
  parent.children.push(child)
  const blocks = [parent, createBlock('text')]
  assert.equal(moveBlock(blocks, parent.id, child.id, 0), false)
  assert.equal(moveBlock(blocks, blocks[1].id, child.id, 0), true)
  assert.equal(child.children[0].type, 'text')
  assert.equal(blocks.length, 1)
  assert.equal(moveBlock(blocks, child.id, 'root', 0), true)
  assert.equal(blocks[0].id, child.id)
  const tabs = createBlock('tabs')
  blocks.push(tabs)
  assert.equal(
    moveBlock(blocks, child.id, tabs.id, 0),
    false,
    'a card cannot become a tab',
  )
})

test('duplicates get fresh ids everywhere, including actions', () => {
  const section = createBlock('section')
  const button = createBlock('button')
  button.actions.push({
    id: 'a1',
    trigger: 'click',
    type: 'showMessage',
    target: '',
    value: 'Hi',
  })
  section.children.push(button)
  const copy = duplicateBlock(section)
  assert.notEqual(copy.id, section.id)
  assert.notEqual(copy.children[0].id, button.id)
  assert.notEqual(copy.children[0].actions[0].id, 'a1')
  copy.children[0].styles['color'] = 'red'
  assert.deepEqual(button.styles, {})
})

test('project round-trips and import rejects unsafe content', () => {
  const project = createProject('Demo')
  project.pages[0].blocks.push(createBlock('heading'), createBlock('form'))
  assert.deepEqual(parseProject(JSON.stringify(project)), project)

  const injected = structuredClone(project)
  injected.pages[0].blocks[0].styles['color'] = 'red; } body { display:none'
  assert.throws(() => parseProject(JSON.stringify(injected)), /unsafe style/)

  const unknown = structuredClone(project) as unknown as {
    pages: { blocks: { type: string }[] }[]
  }
  unknown.pages[0].blocks[0].type = 'script'
  assert.throws(
    () => parseProject(JSON.stringify(unknown)),
    /Unknown block type/,
  )

  const badOption = structuredClone(project)
  badOption.pages[0].blocks[0].props['variant'] = 'evil class'
  assert.equal(
    parseProject(JSON.stringify(badOption)).pages[0].blocks[0].props['variant'],
    'headline-md',
  )

  const misplaced = structuredClone(project)
  misplaced.pages[0].blocks.push(createBlock('tab'))
  assert.throws(
    () => parseProject(JSON.stringify(misplaced)),
    /cannot be placed/,
  )
})

test('missing props are filled from defaults so older saves keep working', () => {
  const project = createProject()
  const block = createBlock('button')
  delete (block.props as Record<string, unknown>)['variant']
  project.pages[0].blocks.push(block)
  assert.equal(
    normalizeProject(JSON.parse(JSON.stringify(project))).pages[0].blocks[0]
      .props['variant'],
    'filled',
  )
})

test('version 1 projects are migrated to version 2', () => {
  const v1 = {
    version: 1,
    name: 'Old site',
    dark: true,
    pages: [
      {
        id: 'p1',
        name: 'Home',
        slug: 'home',
        blocks: [
          {
            id: 'b1',
            type: 'columns',
            name: 'Cols',
            text: '',
            url: '',
            alt: '',
            label: '',
            options: '',
            level: '2',
            inputType: 'text',
            required: false,
            disabled: false,
            columns: 3,
            value: 50,
            styles: { padding: '8px' },
            tabletStyles: {},
            mobileStyles: {},
            children: [
              {
                id: 'b2',
                type: 'heading',
                name: 'H',
                text: 'Hello',
                url: '',
                alt: '',
                label: '',
                options: '',
                level: '1',
                inputType: 'text',
                required: false,
                disabled: false,
                columns: 2,
                value: 50,
                styles: {},
                tabletStyles: {},
                mobileStyles: {},
                children: [],
              },
            ],
          },
          {
            id: 'b3',
            type: 'submit',
            name: 'Send',
            text: 'Send',
            url: '',
            alt: '',
            label: '',
            options: '',
            level: '2',
            inputType: 'text',
            required: false,
            disabled: false,
            columns: 2,
            value: 50,
            styles: {},
            tabletStyles: {},
            mobileStyles: {},
            children: [],
          },
          {
            id: 'b4',
            type: 'tabs',
            name: 'Tabs',
            text: 'Body',
            url: '',
            alt: '',
            label: '',
            options: 'One|First\nTwo',
            level: '2',
            inputType: 'text',
            required: false,
            disabled: false,
            columns: 2,
            value: 50,
            styles: {},
            tabletStyles: {},
            mobileStyles: {},
            children: [],
          },
        ],
      },
    ],
  }
  const project = parseProject(JSON.stringify(v1))
  assert.equal(project.version, 2)
  assert.equal(project.theme.mode, 'dark')
  const [grid, button, tabs] = project.pages[0].blocks
  assert.equal(grid.type, 'grid')
  assert.equal(grid.props['columns'], '3')
  assert.equal(grid.styles['padding'], '8px')
  assert.equal(grid.children[0].props['text'], 'Hello')
  assert.equal(button.props['htmlType'], 'submit')
  assert.deepEqual(
    tabs.children.map((tab) => tab.props['label']),
    ['One', 'Two'],
  )
  assert.equal(tabs.children[1].children[0].props['text'], 'Body')
})

test('bindings resolve by lookup only', () => {
  const scope = {
    vars: { name: 'Ada', count: 3 },
    item: { title: 'Lamp' },
    data: { rows: [1, 2] },
  }
  assert.equal(
    interpolate(
      'Hi {{ vars.name }}, {{item.title}} x{{vars.count}} ({{data.rows.length}})',
      scope,
    ),
    'Hi Ada, Lamp x3 (2)',
  )
  assert.equal(interpolate('{{constructor.name}}{{vars.__proto__}}', scope), '')
  assert.equal(lookup(scope, 'vars.missing.deep'), undefined)
  assert.equal(truthy('false'), false)
  assert.equal(truthy('yes'), true)
  assert.equal(fieldKey('First name'), 'firstName')
})

test('urls and styles are allow-listed', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '')
  assert.equal(safeUrl('//evil.example'), '')
  assert.equal(safeUrl('#pricing'), '#pricing')
  assert.equal(safeUrl('mailto:a@b.c', true), '')
  assert.equal(safeEndpoint('http://insecure.example'), '')
  assert.equal(safeEndpoint('/api/forms'), '/api/forms')
  assert.equal(safeCssUrl('https://img.example/a.png") , url(x'), '')
  assert.equal(safeStyle('color', 'var(--mat-sys-primary)'), true)
  assert.equal(safeStyle('color', 'url(https://bad.example)'), false)
  assert.equal(safeStyle('position', 'fixed'), false)
})

test('unconfigured blocks inherit the theme; overrides are scoped to the block', () => {
  const block = createBlock('text')
  assert.deepEqual(block.styles, {})
  assert.equal(blockCss(block), '')
  assert.match(blockClasses(block), /mat-font-body-lg/)
  block.mobileStyles['padding'] = '8px'
  assert.match(
    blockCss(block),
    /@container wb-site \(max-width:600px\)\{\.wb-site \.wb-el-[\w-]+\{padding:8px\}\}/,
  )
  const section = createBlock('section', {
    backgroundImage: 'https://img.example/hero.jpg',
  })
  assert.match(
    blockCss(section),
    /background-image:url\("https:\/\/img\.example\/hero\.jpg"\)/,
  )
  assert.match(
    siteThemeClasses(createProject().theme),
    /wb-primary-azure .*wb-body-public-sans/,
  )
})

test('templates instantiate with fresh ids and resolved references', () => {
  for (const template of TEMPLATES) {
    const blocks = instantiate(template.blocks, {
      sources: { products: 's1', tasks: 's2' },
      variables: { cartCount: 'v1', userEmail: 'v2', signedIn: 'v3' },
      firstPageId: 'p1',
    })
    const all = flatten(blocks)
    assert.equal(
      new Set(all.map((item) => item.block.id)).size,
      all.length,
      `${template.id} ids not unique`,
    )
    for (const { block, parent } of all)
      assert.ok(
        canContain(parent?.type ?? 'root', block.type),
        `${template.id}: ${block.type} in ${parent?.type}`,
      )
    const project = createProject()
    project.pages[0].blocks = blocks
    assert.doesNotThrow(
      () => normalizeProject(JSON.parse(JSON.stringify(project))),
      template.id,
    )
  }
  const tracker = TEMPLATES.find((template) => template.id === 'page-tracker')!
  const blocks = instantiate(tracker.blocks, {
    sources: { tasks: 'src-1' },
    variables: {},
    firstPageId: '',
  })
  const form = flatten(blocks).find((item) => item.block.type === 'form')!.block
  assert.deepEqual(
    form.actions.map((action) => [action.type, action.target]),
    [['saveToCollection', 'src-1']],
  )
})

test('static export escapes content and expands repeaters from data', () => {
  const project = createProject()
  const link = createBlock('link', {
    text: '<script>alert(1)</script>',
    href: 'javascript:alert(1)',
  })
  const repeater = createBlock('repeater', { source: 'src' }, [
    ['text', { text: '{{item.name}}' }],
  ])
  project.pages[0].blocks.push(link, repeater)
  const html = exportPage(
    project,
    project.pages[0],
    { src: [{ name: 'Alpha' }, { name: '<b>Beta</b>' }] },
    '',
  )
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /javascript:/)
  assert.match(html, /Alpha/)
  assert.match(html, /&lt;b&gt;Beta&lt;\/b&gt;/)
  assert.ok(findBlock(project.pages[0].blocks, repeater.children[0].id))
  assert.equal(definition('repeater')?.container, true)
})
