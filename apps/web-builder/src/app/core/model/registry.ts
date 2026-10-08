/**
 * Block registry: every building block the studio offers, its typed properties and defaults.
 * The inspector, the validator, the renderer and the exporter are all driven from this table,
 * so adding a block means adding one entry here plus its template in the renderer.
 */
import type { ActionType, PropValue, Props, Trigger } from './types'

export type PropKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'toggle'
  | 'url'
  | 'media'
  | 'icon'
  | 'items'
  | 'source'
  | 'page'
  | 'variable'
  | 'field'

export interface Option {
  value: string
  label: string
}

export interface PropDef {
  key: string
  label: string
  kind: PropKind
  default: PropValue
  options?: readonly Option[]
  hint?: string
  min?: number
  max?: number
  /** Inspector section. */
  section: 'content' | 'layout' | 'appearance' | 'data' | 'behaviour'
  /** Only show when another prop has one of these values, e.g. `{ key: 'mode', values: ['determinate'] }`. */
  when?: { key: string; values: PropValue[] }
}

export type BlockGroup =
  | 'Layout'
  | 'Content'
  | 'Navigation'
  | 'Forms'
  | 'Data'
  | 'Overlays'

/** A compact tree description used for default children and templates. */
export type BlockSpec = [
  type: string,
  props?: Props,
  children?: BlockSpec[],
  name?: string,
]

export interface BlockDefinition {
  type: string
  label: string
  icon: string
  group: BlockGroup
  description: string
  container?: boolean
  /** Restricts which block types may be dropped inside. */
  accepts?: readonly string[]
  /** Restricts where this block may be placed (parent types). */
  parents?: readonly string[]
  /** Hidden from the palette (added through a parent, e.g. a tab inside tabs). */
  internal?: boolean
  events?: readonly Trigger[]
  props: readonly PropDef[]
  seed?: readonly BlockSpec[]
}

// ---------------------------------------------------------------------------------------------
// Shared option lists. Each maps to a theme token or a layout class, never to a raw value.
// ---------------------------------------------------------------------------------------------

const o = (...pairs: [string, string][]): Option[] =>
  pairs.map(([value, label]) => ({ value, label }))

export const SPACE_OPTIONS = o(
  ['0', 'None'],
  ['1', 'XS · 4'],
  ['2', 'S · 8'],
  ['3', 'M- · 12'],
  ['4', 'M · 16'],
  ['5', 'L · 24'],
  ['6', 'XL · 32'],
  ['7', '2XL · 48'],
  ['8', '3XL · 64'],
)
export const ALIGN_OPTIONS = o(
  ['stretch', 'Stretch'],
  ['start', 'Start'],
  ['center', 'Center'],
  ['end', 'End'],
  ['baseline', 'Baseline'],
)
export const JUSTIFY_OPTIONS = o(
  ['start', 'Start'],
  ['center', 'Center'],
  ['end', 'End'],
  ['between', 'Space between'],
  ['around', 'Space around'],
  ['evenly', 'Space evenly'],
)
export const SURFACE_OPTIONS = o(
  ['none', 'Transparent'],
  ['surface', 'Surface'],
  ['surface-container-lowest', 'Container lowest'],
  ['surface-container-low', 'Container low'],
  ['surface-container', 'Container'],
  ['surface-container-high', 'Container high'],
  ['surface-container-highest', 'Container highest'],
  ['primary-container', 'Primary container'],
  ['secondary-container', 'Secondary container'],
  ['tertiary-container', 'Tertiary container'],
  ['primary', 'Primary'],
  ['inverse-surface', 'Inverse'],
  ['error-container', 'Error container'],
)
export const CORNER_OPTIONS = o(
  ['none', 'None'],
  ['xs', 'Extra small'],
  ['sm', 'Small'],
  ['md', 'Medium'],
  ['lg', 'Large'],
  ['xl', 'Extra large'],
  ['full', 'Full'],
)
export const ELEVATION_OPTIONS = o(
  ['0', 'Flat'],
  ['1', 'Level 1'],
  ['2', 'Level 2'],
  ['3', 'Level 3'],
  ['4', 'Level 4'],
  ['5', 'Level 5'],
)
export const WIDTH_OPTIONS = o(
  ['full', 'Full width'],
  ['xl', 'Extra wide · 1440'],
  ['lg', 'Wide · 1200'],
  ['md', 'Medium · 960'],
  ['sm', 'Narrow · 640'],
  ['xs', 'Extra narrow · 480'],
)
export const TEXT_VARIANTS = o(
  ['display-lg', 'Display large'],
  ['display-md', 'Display medium'],
  ['display-sm', 'Display small'],
  ['headline-lg', 'Headline large'],
  ['headline-md', 'Headline medium'],
  ['headline-sm', 'Headline small'],
  ['title-lg', 'Title large'],
  ['title-md', 'Title medium'],
  ['title-sm', 'Title small'],
  ['body-lg', 'Body large'],
  ['body-md', 'Body medium'],
  ['body-sm', 'Body small'],
  ['label-lg', 'Label large'],
  ['label-md', 'Label medium'],
  ['label-sm', 'Label small'],
)
export const TONE_OPTIONS = o(
  ['default', 'Default'],
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['muted', 'Muted'],
  ['error', 'Error'],
)
export const TEXT_ALIGN_OPTIONS = o(
  ['start', 'Start'],
  ['center', 'Center'],
  ['end', 'End'],
)
export const BUTTON_VARIANTS = o(
  ['filled', 'Filled'],
  ['tonal', 'Tonal'],
  ['outlined', 'Outlined'],
  ['elevated', 'Elevated'],
  ['text', 'Text'],
  ['icon', 'Icon'],
  ['fab', 'FAB'],
  ['mini-fab', 'Mini FAB'],
  ['extended-fab', 'Extended FAB'],
)
export const COLUMN_OPTIONS = o(
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['4', '4'],
  ['5', '5'],
  ['6', '6'],
  ['auto', 'Auto fit'],
)
export const APPEARANCE_OPTIONS = o(['outline', 'Outline'], ['fill', 'Fill'])
export const SEVERITY_OPTIONS = o(
  ['info', 'Info'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['error', 'Error'],
)
export const INPUT_TYPES = o(
  ['text', 'Text'],
  ['email', 'Email'],
  ['number', 'Number'],
  ['password', 'Password'],
  ['tel', 'Phone'],
  ['url', 'URL'],
  ['search', 'Search'],
)

// ---------------------------------------------------------------------------------------------
// Prop helpers
// ---------------------------------------------------------------------------------------------

type P = Omit<PropDef, 'section'> & { section?: PropDef['section'] }
const content = (def: P): PropDef => ({ section: 'content', ...def })
const text = (key: string, label: string, value = '', hint?: string): PropDef =>
  content({ key, label, kind: 'text', default: value, hint })
const area = (key: string, label: string, value = '', hint?: string): PropDef =>
  content({ key, label, kind: 'textarea', default: value, hint })
const toggle = (
  key: string,
  label: string,
  value = false,
  section: PropDef['section'] = 'behaviour',
): PropDef => ({ key, label, kind: 'toggle', default: value, section })
const select = (
  key: string,
  label: string,
  options: readonly Option[],
  value: string,
  section: PropDef['section'] = 'appearance',
): PropDef => ({ key, label, kind: 'select', options, default: value, section })
const num = (
  key: string,
  label: string,
  value: number,
  min?: number,
  max?: number,
  section: PropDef['section'] = 'content',
): PropDef => ({
  key,
  label,
  kind: 'number',
  default: value,
  min,
  max,
  section,
})

const tooltip = text('tooltip', 'Tooltip', '', 'Shown on hover and focus')
const layout = (
  defaults: {
    gap?: string
    padding?: string
    align?: string
    justify?: string
    surface?: string
    corner?: string
    elevation?: string
  } = {},
): PropDef[] => [
  select('gap', 'Gap', SPACE_OPTIONS, defaults.gap ?? '4', 'layout'),
  select(
    'padding',
    'Padding',
    SPACE_OPTIONS,
    defaults.padding ?? '0',
    'layout',
  ),
  select(
    'align',
    'Align items',
    ALIGN_OPTIONS,
    defaults.align ?? 'stretch',
    'layout',
  ),
  select(
    'justify',
    'Justify content',
    JUSTIFY_OPTIONS,
    defaults.justify ?? 'start',
    'layout',
  ),
  select('surface', 'Surface', SURFACE_OPTIONS, defaults.surface ?? 'none'),
  select('corner', 'Corners', CORNER_OPTIONS, defaults.corner ?? 'none'),
  select(
    'elevation',
    'Elevation',
    ELEVATION_OPTIONS,
    defaults.elevation ?? '0',
  ),
  toggle('outlined', 'Outline', false, 'appearance'),
]
const typography = (variant: string, tone = 'default'): PropDef[] => [
  select('variant', 'Text style', TEXT_VARIANTS, variant),
  select('tone', 'Color', TONE_OPTIONS, tone),
  select('textAlign', 'Alignment', TEXT_ALIGN_OPTIONS, 'start'),
]
const field = (label: string, extra: PropDef[] = []): PropDef[] => [
  text('label', 'Label', label),
  content({
    key: 'field',
    label: 'Field name',
    kind: 'field',
    default: '',
    hint: 'Key used when the form is submitted; defaults to the label',
  }),
  text('hint', 'Hint text'),
  ...extra,
  toggle('required', 'Required'),
  toggle('disabled', 'Disabled'),
  {
    key: 'bind',
    label: 'Bind to variable',
    kind: 'variable',
    default: '',
    section: 'data',
    hint: 'Two-way: the field shows and updates this variable',
  },
]
const sourceProps = (fields: PropDef[] = []): PropDef[] => [
  {
    key: 'source',
    label: 'Data source',
    kind: 'source',
    default: '',
    section: 'data',
    hint: 'Leave empty to use the items typed above',
  },
  ...fields,
]
const items = (
  value: string,
  hint = 'One per line. Use | to separate columns, e.g. Label|value',
): PropDef =>
  content({ key: 'items', label: 'Items', kind: 'items', default: value, hint })

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

export const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
  // Layout ------------------------------------------------------------------------------------
  {
    type: 'section',
    label: 'Section',
    icon: 'view_agenda',
    group: 'Layout',
    container: true,
    description: 'Full-width band with an inner content width.',
    props: [
      select('width', 'Content width', WIDTH_OPTIONS, 'lg', 'layout'),
      ...layout({ padding: '7', gap: '5' }),
      {
        key: 'backgroundImage',
        label: 'Background image',
        kind: 'media',
        default: '',
        section: 'appearance',
        hint: 'https:// image URL',
      },
      toggle('scrim', 'Darken background image', true, 'appearance'),
      text('anchor', 'Anchor id', '', 'Lets links scroll here with #anchor'),
    ],
  },
  {
    type: 'container',
    label: 'Container',
    icon: 'crop_square',
    group: 'Layout',
    container: true,
    description: 'Centered column with a maximum width.',
    props: [
      select('width', 'Max width', WIDTH_OPTIONS, 'md', 'layout'),
      ...layout({ gap: '4' }),
    ],
  },
  {
    type: 'row',
    label: 'Row',
    icon: 'view_column',
    group: 'Layout',
    container: true,
    description: 'Places children side by side; wraps on small screens.',
    props: [
      ...layout({ gap: '4', align: 'center' }),
      toggle('wrap', 'Wrap', true, 'layout'),
      toggle('stackOnMobile', 'Stack on mobile', true, 'layout'),
    ],
  },
  {
    type: 'stack',
    label: 'Stack',
    icon: 'view_stream',
    group: 'Layout',
    container: true,
    description: 'Vertical stack of children.',
    props: layout({ gap: '4' }),
  },
  {
    type: 'grid',
    label: 'Grid',
    icon: 'grid_view',
    group: 'Layout',
    container: true,
    description: 'Responsive grid with separate column counts per screen size.',
    props: [
      select('columns', 'Columns', COLUMN_OPTIONS, '3', 'layout'),
      select('tabletColumns', 'Tablet columns', COLUMN_OPTIONS, '2', 'layout'),
      select('mobileColumns', 'Mobile columns', COLUMN_OPTIONS, '1', 'layout'),
      ...layout({ gap: '5' }),
    ],
    seed: [
      ['card', {}, [['text', { text: 'Grid item' }]]],
      ['card', {}, [['text', { text: 'Grid item' }]]],
      ['card', {}, [['text', { text: 'Grid item' }]]],
    ],
  },
  {
    type: 'card',
    label: 'Card',
    icon: 'crop_portrait',
    group: 'Layout',
    container: true,
    events: ['click'],
    description: 'Material card with optional header, media and content.',
    props: [
      select(
        'appearance',
        'Appearance',
        o(
          ['raised', 'Elevated'],
          ['outlined', 'Outlined'],
          ['filled', 'Filled'],
        ),
        'outlined',
      ),
      text('title', 'Title'),
      text('subtitle', 'Subtitle'),
      content({
        key: 'avatar',
        label: 'Header icon',
        kind: 'icon',
        default: '',
      }),
      {
        key: 'image',
        label: 'Media image',
        kind: 'media',
        default: '',
        section: 'content',
      },
      text('imageAlt', 'Media alt text'),
      select('gap', 'Gap', SPACE_OPTIONS, '3', 'layout'),
      select('align', 'Align items', ALIGN_OPTIONS, 'stretch', 'layout'),
      tooltip,
    ],
    seed: [['text', { text: 'Card content goes here.' }]],
  },
  {
    type: 'toolbar',
    label: 'Toolbar',
    icon: 'web_asset',
    group: 'Layout',
    container: true,
    description: 'Material toolbar for headers and action bars.',
    props: [
      text('title', 'Title', 'My app'),
      content({
        key: 'icon',
        label: 'Leading icon',
        kind: 'icon',
        default: '',
      }),
      select('surface', 'Surface', SURFACE_OPTIONS, 'surface-container'),
      toggle('sticky', 'Stick to top on scroll', false, 'layout'),
      select('gap', 'Gap', SPACE_OPTIONS, '2', 'layout'),
    ],
  },
  {
    type: 'repeater',
    label: 'Repeater',
    icon: 'dynamic_feed',
    group: 'Layout',
    container: true,
    description:
      'Repeats its children for every row of a data source. Use {{item.field}} inside.',
    props: [
      {
        key: 'source',
        label: 'Data source',
        kind: 'source',
        default: '',
        section: 'data',
      },
      num('limit', 'Max items (0 = all)', 0, 0, 500, 'data'),
      text('emptyText', 'Empty message', 'Nothing to show yet.'),
      select('columns', 'Columns', COLUMN_OPTIONS, '3', 'layout'),
      select('tabletColumns', 'Tablet columns', COLUMN_OPTIONS, '2', 'layout'),
      select('mobileColumns', 'Mobile columns', COLUMN_OPTIONS, '1', 'layout'),
      select('gap', 'Gap', SPACE_OPTIONS, '4', 'layout'),
    ],
    seed: [
      [
        'card',
        { title: '{{item.name}}' },
        [['text', { text: '{{item.description}}' }]],
      ],
    ],
  },
  {
    type: 'tabs',
    label: 'Tabs',
    icon: 'tab',
    group: 'Layout',
    container: true,
    accepts: ['tab'],
    description: 'Tabbed panels; each tab holds any blocks.',
    props: [
      select(
        'alignTabs',
        'Tab alignment',
        o(['start', 'Start'], ['center', 'Center'], ['end', 'End']),
        'start',
      ),
      toggle('stretch', 'Stretch tabs', false, 'appearance'),
    ],
    seed: [
      [
        'tab',
        { label: 'Overview' },
        [['text', { text: 'First tab content.' }]],
      ],
      [
        'tab',
        { label: 'Details' },
        [['text', { text: 'Second tab content.' }]],
      ],
    ],
  },
  {
    type: 'tab',
    label: 'Tab',
    icon: 'tab_unselected',
    group: 'Layout',
    container: true,
    parents: ['tabs'],
    internal: true,
    description: 'A single tab.',
    props: [
      text('label', 'Tab label', 'Tab'),
      content({ key: 'icon', label: 'Icon', kind: 'icon', default: '' }),
      ...layout({ gap: '4', padding: '4' }),
    ],
  },
  {
    type: 'accordion',
    label: 'Accordion',
    icon: 'expand_more',
    group: 'Layout',
    container: true,
    accepts: ['panel'],
    description: 'Expansion panels; each panel holds any blocks.',
    props: [toggle('multi', 'Allow several open', false)],
    seed: [
      [
        'panel',
        { title: 'What is included?' },
        [['text', { text: 'Describe the answer here.' }]],
      ],
      [
        'panel',
        { title: 'How does it work?' },
        [['text', { text: 'Describe the answer here.' }]],
      ],
    ],
  },
  {
    type: 'panel',
    label: 'Panel',
    icon: 'unfold_more',
    group: 'Layout',
    container: true,
    parents: ['accordion'],
    internal: true,
    description: 'A single expansion panel.',
    props: [
      text('title', 'Title', 'Panel'),
      text('description', 'Description'),
      toggle('expanded', 'Start expanded'),
      ...layout({ gap: '3' }),
    ],
  },
  {
    type: 'stepper',
    label: 'Stepper',
    icon: 'linear_scale',
    group: 'Layout',
    container: true,
    accepts: ['step'],
    description: 'Multi-step flow such as a wizard or checkout.',
    props: [
      select(
        'orientation',
        'Orientation',
        o(['horizontal', 'Horizontal'], ['vertical', 'Vertical']),
        'horizontal',
      ),
      toggle('linear', 'Require each step in order'),
    ],
    seed: [
      ['step', { label: 'Details' }, [['text', { text: 'Step one.' }]]],
      ['step', { label: 'Confirm' }, [['text', { text: 'Step two.' }]]],
    ],
  },
  {
    type: 'step',
    label: 'Step',
    icon: 'looks_one',
    group: 'Layout',
    container: true,
    parents: ['stepper'],
    internal: true,
    description: 'A single step.',
    props: [
      text('label', 'Step label', 'Step'),
      toggle('optional', 'Optional'),
      toggle('navigation', 'Show Back / Next buttons', true),
      ...layout({ gap: '4', padding: '2' }),
    ],
  },

  // Content ----------------------------------------------------------------------------------
  {
    type: 'heading',
    label: 'Heading',
    icon: 'title',
    group: 'Content',
    description: 'Semantic heading using the theme type scale.',
    props: [
      text('text', 'Text', 'Your heading'),
      select(
        'level',
        'Level',
        o(
          ['1', 'H1'],
          ['2', 'H2'],
          ['3', 'H3'],
          ['4', 'H4'],
          ['5', 'H5'],
          ['6', 'H6'],
        ),
        '2',
        'content',
      ),
      ...typography('headline-md'),
    ],
  },
  {
    type: 'text',
    label: 'Text',
    icon: 'notes',
    group: 'Content',
    description: 'Paragraph text. Supports {{variables}}.',
    props: [
      area('text', 'Text', 'Write your content here.'),
      ...typography('body-lg'),
    ],
  },
  {
    type: 'image',
    label: 'Image',
    icon: 'image',
    group: 'Content',
    events: ['click'],
    description: 'Responsive image.',
    props: [
      {
        key: 'src',
        label: 'Image URL',
        kind: 'media',
        default:
          'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
        section: 'content',
      },
      text('alt', 'Alternative text', 'Office workspace'),
      text('caption', 'Caption'),
      select(
        'ratio',
        'Aspect ratio',
        o(
          ['auto', 'Original'],
          ['16-9', '16:9'],
          ['4-3', '4:3'],
          ['1-1', 'Square'],
          ['21-9', 'Wide'],
        ),
        'auto',
        'appearance',
      ),
      select(
        'fit',
        'Fit',
        o(['cover', 'Cover'], ['contain', 'Contain']),
        'cover',
      ),
      select('corner', 'Corners', CORNER_OPTIONS, 'md'),
      tooltip,
    ],
  },
  {
    type: 'video',
    label: 'Video',
    icon: 'videocam',
    group: 'Content',
    description: 'HTML5 video player.',
    props: [
      {
        key: 'src',
        label: 'Video URL',
        kind: 'media',
        default: '',
        section: 'content',
      },
      {
        key: 'poster',
        label: 'Poster image',
        kind: 'media',
        default: '',
        section: 'content',
      },
      text('label', 'Accessible label', 'Video'),
      toggle('autoplay', 'Autoplay (muted)'),
      toggle('loop', 'Loop'),
      select('corner', 'Corners', CORNER_OPTIONS, 'md'),
    ],
  },
  {
    type: 'audio',
    label: 'Audio',
    icon: 'audiotrack',
    group: 'Content',
    description: 'HTML5 audio player.',
    props: [
      {
        key: 'src',
        label: 'Audio URL',
        kind: 'media',
        default: '',
        section: 'content',
      },
      text('label', 'Accessible label', 'Audio'),
    ],
  },
  {
    type: 'embed',
    label: 'Embed',
    icon: 'code_blocks',
    group: 'Content',
    description: 'Sandboxed https embed such as a map or a video page.',
    props: [
      {
        key: 'src',
        label: 'Embed URL (https)',
        kind: 'url',
        default: '',
        section: 'content',
      },
      text('title', 'Title', 'Embedded content'),
      select(
        'ratio',
        'Aspect ratio',
        o(['16-9', '16:9'], ['4-3', '4:3'], ['1-1', 'Square']),
        '16-9',
      ),
      select('corner', 'Corners', CORNER_OPTIONS, 'md'),
    ],
  },
  {
    type: 'button',
    label: 'Button',
    icon: 'smart_button',
    group: 'Content',
    events: ['click'],
    description: 'Material button. Add actions under Behaviour.',
    props: [
      text('text', 'Label', 'Continue'),
      select('variant', 'Style', BUTTON_VARIANTS, 'filled'),
      content({ key: 'icon', label: 'Icon', kind: 'icon', default: '' }),
      select(
        'htmlType',
        'Type',
        o(
          ['button', 'Button'],
          ['submit', 'Submit form'],
          ['reset', 'Reset form'],
        ),
        'button',
        'behaviour',
      ),
      {
        key: 'href',
        label: 'Link URL',
        kind: 'url',
        default: '',
        section: 'behaviour',
        hint: 'Optional. Prefer a Navigate action for pages.',
      },
      toggle('fullWidth', 'Full width', false, 'appearance'),
      toggle('disabled', 'Disabled'),
      tooltip,
    ],
  },
  {
    type: 'link',
    label: 'Link',
    icon: 'link',
    group: 'Content',
    events: ['click'],
    description: 'Inline text link to a URL, page or anchor.',
    props: [
      text('text', 'Text', 'Learn more'),
      {
        key: 'href',
        label: 'URL',
        kind: 'url',
        default: '#',
        section: 'content',
      },
      toggle('newTab', 'Open in new tab'),
      ...typography('body-lg', 'primary'),
    ],
  },
  {
    type: 'icon',
    label: 'Icon',
    icon: 'star_outline',
    group: 'Content',
    events: ['click'],
    description: 'Material icon.',
    props: [
      content({ key: 'icon', label: 'Icon', kind: 'icon', default: 'star' }),
      text('label', 'Accessible label'),
      select(
        'size',
        'Size',
        o(
          ['sm', 'Small'],
          ['md', 'Medium'],
          ['lg', 'Large'],
          ['xl', 'Extra large'],
        ),
        'md',
      ),
      select('tone', 'Color', TONE_OPTIONS, 'primary'),
      tooltip,
    ],
  },
  {
    type: 'list',
    label: 'Bullet list',
    icon: 'format_list_bulleted',
    group: 'Content',
    description: 'Bulleted or numbered list.',
    props: [
      items('First item\nSecond item\nThird item', 'One item per line'),
      toggle('ordered', 'Numbered', false, 'appearance'),
      ...typography('body-lg'),
    ],
  },
  {
    type: 'quote',
    label: 'Quote',
    icon: 'format_quote',
    group: 'Content',
    description: 'Pull quote or testimonial.',
    props: [
      area('text', 'Quote', 'This product changed how our team works.'),
      text('cite', 'Attribution', 'Alex Morgan, Head of Operations'),
      ...typography('title-lg'),
    ],
  },
  {
    type: 'code',
    label: 'Code',
    icon: 'code',
    group: 'Content',
    description: 'Preformatted code snippet.',
    props: [area('text', 'Code', 'npm install\nnpm start')],
  },
  {
    type: 'chips',
    label: 'Chips',
    icon: 'sell',
    group: 'Content',
    description: 'Static set of chips or tags.',
    props: [
      items('Design\nResearch\nEngineering', 'One chip per line'),
      toggle('selectable', 'Selectable', false),
    ],
  },
  {
    type: 'avatar',
    label: 'Avatar',
    icon: 'account_circle',
    group: 'Content',
    description: 'Round image or initials with a name.',
    props: [
      {
        key: 'src',
        label: 'Image URL',
        kind: 'media',
        default: '',
        section: 'content',
      },
      text('name', 'Name', 'Alex Morgan'),
      text('caption', 'Caption', 'Product designer'),
      select(
        'size',
        'Size',
        o(['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']),
        'md',
      ),
    ],
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: 'horizontal_rule',
    group: 'Content',
    description: 'Horizontal rule.',
    props: [toggle('inset', 'Inset', false, 'appearance')],
  },
  {
    type: 'spacer',
    label: 'Spacer',
    icon: 'height',
    group: 'Content',
    description: 'Vertical whitespace.',
    props: [select('size', 'Height', SPACE_OPTIONS, '6', 'layout')],
  },

  // Navigation --------------------------------------------------------------------------------
  {
    type: 'nav',
    label: 'Navigation links',
    icon: 'menu',
    group: 'Navigation',
    description: 'Horizontal links. Can list the app pages automatically.',
    props: [
      toggle('usePages', 'List pages shown in navigation', true, 'content'),
      items(
        'Home|#home\nAbout|#about\nContact|#contact',
        'Label|URL per line (used when page list is off)',
      ),
      select(
        'variant',
        'Style',
        o(
          ['text', 'Text buttons'],
          ['tonal', 'Tonal buttons'],
          ['tabs', 'Tab bar'],
        ),
        'text',
      ),
      select('justify', 'Justify', JUSTIFY_OPTIONS, 'start', 'layout'),
    ],
  },
  {
    type: 'nav-list',
    label: 'Navigation list',
    icon: 'list',
    group: 'Navigation',
    description: 'Vertical Material navigation list for sidebars.',
    props: [
      toggle('usePages', 'List pages shown in navigation', true, 'content'),
      items(
        'Dashboard|#dashboard|dashboard\nReports|#reports|bar_chart',
        'Label|URL|icon per line',
      ),
    ],
  },
  {
    type: 'menu',
    label: 'Menu',
    icon: 'more_vert',
    group: 'Navigation',
    description: 'Button that opens a menu of links.',
    props: [
      text('text', 'Button label', 'Menu'),
      content({
        key: 'icon',
        label: 'Button icon',
        kind: 'icon',
        default: 'more_vert',
      }),
      items(
        'Profile|#profile|person\nSettings|#settings|settings\nSign out|#sign-out|logout',
        'Label|URL|icon per line',
      ),
    ],
  },
  {
    type: 'breadcrumbs',
    label: 'Breadcrumbs',
    icon: 'chevron_right',
    group: 'Navigation',
    description: 'Trail of links to parent pages.',
    props: [
      items(
        'Home|#home\nProducts|#products\nDetails',
        'Label|URL per line; last item is the current page',
      ),
    ],
  },

  // Forms --------------------------------------------------------------------------------------
  {
    type: 'form',
    label: 'Form',
    icon: 'dynamic_form',
    group: 'Forms',
    container: true,
    events: ['submit'],
    description: 'Groups fields; runs its Submit actions when valid.',
    props: [
      ...layout({ gap: '4' }),
      text(
        'successMessage',
        'Success message',
        'Thanks! Your response was received.',
      ),
      toggle('resetOnSubmit', 'Clear fields after submit', true),
    ],
    seed: [
      ['input', { label: 'Name' }],
      ['input', { label: 'Email', inputType: 'email', required: true }],
      ['button', { text: 'Submit', htmlType: 'submit' }],
    ],
  },
  {
    type: 'input',
    label: 'Text field',
    icon: 'input',
    group: 'Forms',
    events: ['change'],
    description: 'Single-line text input.',
    props: field('Label', [
      select('inputType', 'Input type', INPUT_TYPES, 'text', 'content'),
      text('placeholder', 'Placeholder'),
      content({
        key: 'prefixIcon',
        label: 'Prefix icon',
        kind: 'icon',
        default: '',
      }),
      select('appearance', 'Appearance', APPEARANCE_OPTIONS, 'outline'),
      num('minLength', 'Min length', 0, 0, 10000, 'behaviour'),
      num('maxLength', 'Max length (0 = none)', 0, 0, 10000, 'behaviour'),
      text('pattern', 'Pattern (regex)', ''),
    ]),
  },
  {
    type: 'textarea',
    label: 'Text area',
    icon: 'subject',
    group: 'Forms',
    events: ['change'],
    description: 'Multi-line input.',
    props: field('Message', [
      text('placeholder', 'Placeholder'),
      num('rows', 'Rows', 4, 2, 20),
      select('appearance', 'Appearance', APPEARANCE_OPTIONS, 'outline'),
      num('maxLength', 'Max length (0 = none)', 0, 0, 20000, 'behaviour'),
    ]),
  },
  {
    type: 'select',
    label: 'Select',
    icon: 'arrow_drop_down_circle',
    group: 'Forms',
    events: ['change'],
    description: 'Drop-down with single or multiple choice.',
    props: field('Choose one', [
      items('Option A\nOption B\nOption C', 'One per line, or Label|value'),
      toggle('multiple', 'Multiple selection'),
      select('appearance', 'Appearance', APPEARANCE_OPTIONS, 'outline'),
      ...sourceProps([
        text(
          'labelField',
          'Label field',
          'name',
          'Column used for option text',
        ),
        text('valueField', 'Value field', 'id'),
      ]),
    ]),
  },
  {
    type: 'autocomplete',
    label: 'Autocomplete',
    icon: 'manage_search',
    group: 'Forms',
    events: ['change'],
    description: 'Text field with suggestions.',
    props: field('Search', [
      items('Apple\nBanana\nCherry', 'Suggestions, one per line'),
      select('appearance', 'Appearance', APPEARANCE_OPTIONS, 'outline'),
      ...sourceProps([text('labelField', 'Label field', 'name')]),
    ]),
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: 'check_box',
    group: 'Forms',
    events: ['change'],
    description: 'Single yes/no choice.',
    props: field('I agree to the terms'),
  },
  {
    type: 'radio',
    label: 'Radio group',
    icon: 'radio_button_checked',
    group: 'Forms',
    events: ['change'],
    description: 'One choice from a short list.',
    props: field('Choose a plan', [
      items('Basic\nPro\nEnterprise', 'One per line, or Label|value'),
      toggle('vertical', 'Stack vertically', false, 'appearance'),
    ]),
  },
  {
    type: 'switch',
    label: 'Switch',
    icon: 'toggle_on',
    group: 'Forms',
    events: ['change'],
    description: 'On/off toggle.',
    props: field('Enable notifications'),
  },
  {
    type: 'slider',
    label: 'Slider',
    icon: 'tune',
    group: 'Forms',
    events: ['change'],
    description: 'Numeric range input.',
    props: field('Volume', [
      num('min', 'Minimum', 0),
      num('max', 'Maximum', 100),
      num('step', 'Step', 1, 0),
      num('value', 'Initial value', 50),
      toggle('discrete', 'Show value label', true, 'appearance'),
    ]),
  },
  {
    type: 'datepicker',
    label: 'Date picker',
    icon: 'calendar_today',
    group: 'Forms',
    events: ['change'],
    description: 'Material date picker.',
    props: field('Date', [
      select('appearance', 'Appearance', APPEARANCE_OPTIONS, 'outline'),
      toggle('range', 'Date range', false, 'content'),
    ]),
  },
  {
    type: 'timepicker',
    label: 'Time picker',
    icon: 'schedule',
    group: 'Forms',
    events: ['change'],
    description: 'Material time picker.',
    props: field('Time', [
      select('appearance', 'Appearance', APPEARANCE_OPTIONS, 'outline'),
      text('interval', 'Interval', '30m', 'e.g. 15m, 1h'),
    ]),
  },
  {
    type: 'toggle-group',
    label: 'Button toggle',
    icon: 'view_week',
    group: 'Forms',
    events: ['change'],
    description: 'Segmented choice buttons.',
    props: field('View', [
      items('Day\nWeek\nMonth', 'One per line, or Label|value'),
      toggle('multiple', 'Multiple selection'),
    ]),
  },
  {
    type: 'chip-input',
    label: 'Tags input',
    icon: 'new_label',
    group: 'Forms',
    events: ['change'],
    description: 'Type and press Enter to add tags.',
    props: field('Tags', [
      select('appearance', 'Appearance', APPEARANCE_OPTIONS, 'outline'),
      text('placeholder', 'Placeholder', 'Add tag…'),
    ]),
  },
  {
    type: 'file',
    label: 'File upload',
    icon: 'upload_file',
    group: 'Forms',
    events: ['change'],
    description: 'Pick files; names are submitted with the form.',
    props: field('Attachment', [
      text('accept', 'Accepted types', 'image/*,.pdf'),
      toggle('multiple', 'Multiple files'),
    ]),
  },

  // Data ----------------------------------------------------------------------------------------
  {
    type: 'table',
    label: 'Data table',
    icon: 'table_chart',
    group: 'Data',
    description: 'Material table with sorting, filtering and paging.',
    props: [
      items(
        'Name|Role|Status\nAva Patel|Designer|Active\nLiam Chen|Engineer|Active\nNoah Kim|Analyst|Away',
        'First line is the header. Ignored when a data source is set.',
      ),
      ...sourceProps([
        content({
          key: 'columns',
          label: 'Columns',
          kind: 'items',
          default: '',
          hint: 'field|Header per line; empty shows every field',
          section: 'data',
        }),
      ]),
      toggle('sortable', 'Sortable columns', true),
      toggle('filter', 'Search box', true),
      toggle('paginate', 'Paginator', true),
      num('pageSize', 'Rows per page', 5, 1, 100, 'behaviour'),
      toggle('striped', 'Outlined container', true, 'appearance'),
    ],
  },
  {
    type: 'data-list',
    label: 'Data list',
    icon: 'view_list',
    group: 'Data',
    description: 'Material list with icon, title and supporting text.',
    props: [
      items(
        'Inbox|12 new messages|inbox\nDrafts|2 drafts|drafts\nArchive|Older items|archive',
        'Title|supporting text|icon per line',
      ),
      ...sourceProps([
        text('titleField', 'Title field', 'name'),
        text('subtitleField', 'Supporting field', 'description'),
        text('iconField', 'Icon field', ''),
      ]),
      content({
        key: 'icon',
        label: 'Default icon',
        kind: 'icon',
        default: 'label',
      }),
    ],
  },
  {
    type: 'stat',
    label: 'Statistic',
    icon: 'insights',
    group: 'Data',
    description: 'KPI tile with label, value and trend.',
    props: [
      text('label', 'Label', 'Active users'),
      text('value', 'Value', '1,280'),
      text('trend', 'Trend', '+12% this month'),
      select('trendTone', 'Trend color', TONE_OPTIONS, 'primary'),
      content({ key: 'icon', label: 'Icon', kind: 'icon', default: 'group' }),
      select(
        'appearance',
        'Appearance',
        o(
          ['outlined', 'Outlined'],
          ['filled', 'Filled'],
          ['raised', 'Elevated'],
        ),
        'outlined',
      ),
    ],
  },
  {
    type: 'chart',
    label: 'Chart',
    icon: 'bar_chart',
    group: 'Data',
    description: 'Bar or line chart in theme colors.',
    props: [
      select(
        'chartType',
        'Chart type',
        o(['bar', 'Bar'], ['line', 'Line']),
        'bar',
        'content',
      ),
      text('title', 'Title', 'Monthly revenue'),
      items(
        'Jan|12\nFeb|19\nMar|15\nApr|24\nMay|28\nJun|31',
        'Label|value per line',
      ),
      ...sourceProps([
        text('labelField', 'Label field', 'label'),
        text('valueField', 'Value field', 'value'),
      ]),
    ],
  },
  {
    type: 'progress',
    label: 'Progress',
    icon: 'donut_large',
    group: 'Data',
    description: 'Progress bar or spinner.',
    props: [
      text('label', 'Label', 'Profile completion'),
      select(
        'shape',
        'Shape',
        o(['bar', 'Bar'], ['spinner', 'Spinner']),
        'bar',
        'content',
      ),
      select(
        'mode',
        'Mode',
        o(
          ['determinate', 'Determinate'],
          ['indeterminate', 'Indeterminate'],
          ['buffer', 'Buffer'],
        ),
        'determinate',
        'content',
      ),
      text('value', 'Value (0–100)', '60', 'Number or {{variable}}'),
    ],
  },
  {
    type: 'calendar',
    label: 'Calendar',
    icon: 'calendar_month',
    group: 'Data',
    events: ['change'],
    description: 'Inline month calendar.',
    props: [
      text('field', 'Field name', 'date'),
      {
        key: 'bind',
        label: 'Bind to variable',
        kind: 'variable',
        default: '',
        section: 'data',
      },
    ],
  },

  // Overlays & feedback ---------------------------------------------------------------------
  {
    type: 'alert',
    label: 'Alert',
    icon: 'info',
    group: 'Overlays',
    description: 'Inline status message.',
    props: [
      text('title', 'Title', 'Heads up'),
      area('text', 'Message', 'Something worth knowing.'),
      select('severity', 'Severity', SEVERITY_OPTIONS, 'info', 'appearance'),
      toggle('dismissible', 'Can be dismissed'),
    ],
  },
  {
    type: 'badge',
    label: 'Badge',
    icon: 'label',
    group: 'Overlays',
    description: 'Small status label.',
    props: [
      text('text', 'Text', 'New'),
      select(
        'surface',
        'Color',
        o(
          ['secondary-container', 'Secondary'],
          ['primary-container', 'Primary'],
          ['tertiary-container', 'Tertiary'],
          ['error-container', 'Error'],
          ['surface-container-high', 'Neutral'],
        ),
        'secondary-container',
      ),
    ],
  },
  {
    type: 'dialog',
    label: 'Dialog',
    icon: 'open_in_new',
    group: 'Overlays',
    container: true,
    description: 'Hidden until opened by an “Open dialog” action.',
    props: [
      text('title', 'Title', 'Dialog'),
      select(
        'size',
        'Width',
        o(['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']),
        'md',
        'layout',
      ),
      toggle('closeButton', 'Show close button', true, 'appearance'),
      select('gap', 'Gap', SPACE_OPTIONS, '4', 'layout'),
    ],
    seed: [['text', { text: 'Dialog content.' }]],
  },
]

const BY_TYPE = new Map(
  BLOCK_DEFINITIONS.map((definition) => [definition.type, definition]),
)

export const BLOCK_GROUPS: readonly BlockGroup[] = [
  'Layout',
  'Content',
  'Navigation',
  'Forms',
  'Data',
  'Overlays',
]

export function definition(type: string): BlockDefinition | undefined {
  return BY_TYPE.get(type)
}

export function isContainer(type: string): boolean {
  return !!BY_TYPE.get(type)?.container
}

/** Whether `childType` may be placed inside a parent of `parentType` ('root' for the page). */
export function canContain(parentType: string, childType: string): boolean {
  const child = BY_TYPE.get(childType)
  if (!child) return false
  if (parentType === 'root') return !child.parents
  const parent = BY_TYPE.get(parentType)
  if (!parent?.container) return false
  if (parent.accepts && !parent.accepts.includes(childType)) return false
  if (child.parents && !child.parents.includes(parentType)) return false
  // Dialogs are page-level overlays.
  return childType !== 'dialog'
}

export function defaultProps(type: string): Props {
  const props: Props = {}
  for (const prop of BY_TYPE.get(type)?.props ?? [])
    props[prop.key] = prop.default
  return props
}

export function isFormField(type: string): boolean {
  return [
    'input',
    'textarea',
    'select',
    'autocomplete',
    'checkbox',
    'radio',
    'switch',
    'slider',
    'datepicker',
    'timepicker',
    'toggle-group',
    'chip-input',
    'file',
    'calendar',
  ].includes(type)
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

export type ActionTargetKind =
  | 'field'
  | 'mutation'
  | 'none'
  | 'page'
  | 'url'
  | 'dialog'
  | 'variable'
  | 'source'
  | 'collection'
  | 'block'
export type ActionValueKind = 'none' | 'text' | 'newTab' | 'method'

export interface ActionDefinition {
  type: ActionType
  label: string
  icon: string
  target: ActionTargetKind
  targetLabel?: string
  value: ActionValueKind
  valueLabel?: string
}

export const ACTION_DEFINITIONS: readonly ActionDefinition[] = [
  {
    type: 'navigate',
    label: 'Go to page',
    icon: 'arrow_forward',
    target: 'page',
    targetLabel: 'Page',
    value: 'none',
  },
  {
    type: 'openUrl',
    label: 'Open URL',
    icon: 'open_in_new',
    target: 'url',
    targetLabel: 'URL',
    value: 'newTab',
  },
  {
    type: 'showMessage',
    label: 'Show message',
    icon: 'chat_bubble',
    target: 'none',
    value: 'text',
    valueLabel: 'Message',
  },
  {
    type: 'openDialog',
    label: 'Open dialog',
    icon: 'open_in_full',
    target: 'dialog',
    targetLabel: 'Dialog',
    value: 'none',
  },
  {
    type: 'closeDialog',
    label: 'Close dialog',
    icon: 'close_fullscreen',
    target: 'none',
    value: 'none',
  },
  {
    type: 'setVariable',
    label: 'Set variable',
    icon: 'data_object',
    target: 'variable',
    targetLabel: 'Variable',
    value: 'text',
    valueLabel: 'Value (supports {{…}})',
  },
  {
    type: 'toggleVariable',
    label: 'Toggle variable',
    icon: 'toggle_on',
    target: 'variable',
    targetLabel: 'Variable',
    value: 'none',
  },
  {
    type: 'incrementVariable',
    label: 'Increase variable',
    icon: 'exposure_plus_1',
    target: 'variable',
    targetLabel: 'Variable',
    value: 'text',
    valueLabel: 'Amount (negative decreases)',
  },
  {
    type: 'submitForm',
    label: 'Send form to API',
    icon: 'cloud_upload',
    target: 'url',
    targetLabel: 'Endpoint URL',
    value: 'method',
    valueLabel: 'Method',
  },
  {
    type: 'saveToCollection',
    label: 'Save form to collection',
    icon: 'playlist_add',
    target: 'collection',
    targetLabel: 'Collection',
    value: 'none',
  },
  {
    type: 'clearCollection',
    label: 'Clear collection',
    icon: 'playlist_remove',
    target: 'collection',
    targetLabel: 'Collection',
    value: 'none',
  },
  {
    type: 'refreshData',
    label: 'Reload data source',
    icon: 'refresh',
    target: 'source',
    targetLabel: 'Data source',
    value: 'none',
  },
  {
    type: 'resetForm',
    label: 'Reset form',
    icon: 'restart_alt',
    target: 'none',
    value: 'none',
  },
  {
    type: 'scrollTo',
    label: 'Scroll to block',
    icon: 'south',
    target: 'block',
    targetLabel: 'Block',
    value: 'none',
  },
  {
    type: 'setField',
    label: 'Set field value',
    icon: 'edit_note',
    target: 'field',
    targetLabel: 'Field',
    value: 'text',
    valueLabel: 'Value (supports {{…}})',
  },
  {
    type: 'callApi',
    label: 'Call API (mutation)',
    icon: 'send',
    target: 'mutation',
    targetLabel: 'Endpoint',
    value: 'none',
  },
]

export function actionDefinition(type: string): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((action) => action.type === type)
}

export const TRIGGER_LABELS: Record<Trigger, string> = {
  click: 'On click',
  submit: 'On submit',
  change: 'On change',
  load: 'On page load',
}
