/**
 * Style overrides and theme presets.
 *
 * Blocks render with theme presets (Material system classes + shared layout classes) chosen
 * through their props. A user can additionally override CSS per block and per viewport; those
 * overrides are compiled into one generated stylesheet keyed by the block's id class, so the
 * templates never carry inline styles.
 */
import type { Block, Props, ThemeSettings } from './types'

export type StyleInput = 'length' | 'color' | 'select' | 'text' | 'number'

export interface StyleProperty {
  property: string
  label: string
  input: StyleInput
  options?: readonly string[]
  placeholder?: string
}

export interface StyleGroup {
  label: string
  icon: string
  properties: readonly StyleProperty[]
}

const len = (
  property: string,
  label: string,
  placeholder = 'e.g. 16px, 1rem, 50%',
): StyleProperty => ({ property, label, input: 'length', placeholder })
const col = (property: string, label: string): StyleProperty => ({
  property,
  label,
  input: 'color',
})
const sel = (
  property: string,
  label: string,
  options: string[],
): StyleProperty => ({ property, label, input: 'select', options })

export const STYLE_GROUPS: readonly StyleGroup[] = [
  {
    label: 'Spacing',
    icon: 'padding',
    properties: [
      len('padding', 'Padding', 'e.g. 16px or 8px 16px'),
      len('padding-top', 'Padding top'),
      len('padding-bottom', 'Padding bottom'),
      len('padding-left', 'Padding left'),
      len('padding-right', 'Padding right'),
      len('margin', 'Margin', 'e.g. 0 auto'),
      len('margin-top', 'Margin top'),
      len('margin-bottom', 'Margin bottom'),
    ],
  },
  {
    label: 'Size',
    icon: 'aspect_ratio',
    properties: [
      len('width', 'Width'),
      len('max-width', 'Max width'),
      len('min-width', 'Min width'),
      len('height', 'Height'),
      len('min-height', 'Min height'),
      len('max-height', 'Max height'),
    ],
  },
  {
    label: 'Typography',
    icon: 'text_fields',
    properties: [
      col('color', 'Text color'),
      len('font-size', 'Font size'),
      sel('font-weight', 'Font weight', [
        '300',
        '400',
        '500',
        '600',
        '700',
        '800',
      ]),
      sel('font-style', 'Font style', ['normal', 'italic']),
      len('line-height', 'Line height', 'e.g. 1.5'),
      len('letter-spacing', 'Letter spacing', 'e.g. 0.02em'),
      sel('text-align', 'Text align', ['start', 'center', 'end', 'justify']),
      sel('text-transform', 'Transform', [
        'none',
        'uppercase',
        'lowercase',
        'capitalize',
      ]),
      sel('text-decoration', 'Decoration', [
        'none',
        'underline',
        'line-through',
      ]),
    ],
  },
  {
    label: 'Background',
    icon: 'format_color_fill',
    properties: [col('background-color', 'Background color')],
  },
  {
    label: 'Border',
    icon: 'border_style',
    properties: [
      len('border', 'Border', 'e.g. 1px solid var(--mat-sys-outline)'),
      col('border-color', 'Border color'),
      len('border-width', 'Border width'),
      sel('border-style', 'Border style', [
        'none',
        'solid',
        'dashed',
        'dotted',
      ]),
      len('border-radius', 'Corner radius'),
    ],
  },
  {
    label: 'Effects',
    icon: 'blur_on',
    properties: [
      sel('box-shadow', 'Shadow', [
        'none',
        'var(--mat-sys-level1)',
        'var(--mat-sys-level2)',
        'var(--mat-sys-level3)',
        'var(--mat-sys-level4)',
        'var(--mat-sys-level5)',
      ]),
      len('opacity', 'Opacity', '0 – 1'),
    ],
  },
  {
    label: 'Layout',
    icon: 'dashboard',
    properties: [
      sel('display', 'Display', [
        'block',
        'flex',
        'grid',
        'inline-flex',
        'none',
      ]),
      sel('flex-direction', 'Direction', [
        'row',
        'column',
        'row-reverse',
        'column-reverse',
      ]),
      sel('flex-wrap', 'Wrap', ['nowrap', 'wrap']),
      sel('align-items', 'Align items', [
        'stretch',
        'flex-start',
        'center',
        'flex-end',
        'baseline',
      ]),
      sel('justify-content', 'Justify content', [
        'flex-start',
        'center',
        'flex-end',
        'space-between',
        'space-around',
        'space-evenly',
      ]),
      len('gap', 'Gap'),
      len('grid-template-columns', 'Grid columns', 'e.g. 1fr 2fr'),
      len('flex', 'Flex', 'e.g. 1 1 0'),
      len('order', 'Order', 'e.g. -1'),
    ],
  },
]

export const STYLE_PROPERTIES: readonly string[] = STYLE_GROUPS.flatMap(
  (group) => group.properties.map((item) => item.property),
)

/** Material color roles offered in color pickers; values are theme tokens so they follow light/dark. */
export const THEME_COLORS: readonly { label: string; value: string }[] = [
  'primary',
  'on-primary',
  'primary-container',
  'on-primary-container',
  'secondary',
  'secondary-container',
  'on-secondary-container',
  'tertiary',
  'tertiary-container',
  'on-tertiary-container',
  'error',
  'error-container',
  'surface',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'on-surface',
  'on-surface-variant',
  'outline',
  'outline-variant',
  'inverse-surface',
].map((role) => ({
  label: role.replace(/-/g, ' '),
  value: `var(--mat-sys-${role})`,
}))

export function safeStyle(property: string, value: string): boolean {
  return (
    STYLE_PROPERTIES.includes(property) &&
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 240 &&
    !/[{};<>\\"'`]|url\s*\(|expression\s*\(|@import|javascript:/i.test(value)
  )
}

/** Accepts only http(s) or root-relative URLs that are safe to embed in CSS `url("…")`. */
export function safeCssUrl(value: string): string {
  const trimmed = String(value ?? '').trim()
  if (
    !/^(https?:\/\/|\/(?!\/))/i.test(trimmed) ||
    /["'()\\\s<>]/.test(trimmed) ||
    trimmed.length > 2000
  )
    return ''
  return trimmed
}

const ELEMENT_ID = /^[a-zA-Z0-9-]{1,80}$/

/** Compiles one block's overrides (and its descendants') into CSS. */
export function blockCss(block: Block): string {
  if (!ELEMENT_ID.test(block.id)) return ''
  const selector = `.wb-site .wb-el-${block.id}`
  const declarations = (styles: Record<string, string>) =>
    Object.entries(styles)
      .filter(([property, value]) => safeStyle(property, value))
      .map(([property, value]) => `${property}:${value.trim()}`)
      .join(';')
  let css = ''
  if (block.type === 'section') {
    const image = safeCssUrl(String(block.props['backgroundImage'] ?? ''))
    if (image) css += `${selector}{background-image:url("${image}")}`
  }
  const base = declarations(block.styles)
  const tablet = declarations(block.tabletStyles)
  const mobile = declarations(block.mobileStyles)
  if (base) css += `${selector}{${base}}`
  if (tablet)
    css += `@container wb-site (max-width:1024px){${selector}{${tablet}}}`
  if (mobile)
    css += `@container wb-site (max-width:600px){${selector}{${mobile}}}`
  return css + block.children.map(blockCss).join('')
}

export function hasOverrides(block: Block): boolean {
  return [block.styles, block.tabletStyles, block.mobileStyles].some(
    (map) => Object.keys(map).length > 0,
  )
}

// ---------------------------------------------------------------------------------------------
// Theme presets → classes
// ---------------------------------------------------------------------------------------------

const SURFACE_TEXT: Record<string, string> = {
  surface: 'mat-text-on-surface',
  'surface-container-lowest': 'mat-text-on-surface',
  'surface-container-low': 'mat-text-on-surface',
  'surface-container': 'mat-text-on-surface',
  'surface-container-high': 'mat-text-on-surface',
  'surface-container-highest': 'mat-text-on-surface',
  'primary-container': 'mat-text-on-primary-container',
  'secondary-container': 'mat-text-on-secondary-container',
  primary: 'mat-text-on-primary',
  'inverse-surface': 'mat-text-inverse-on-surface',
  'error-container': 'mat-text-on-error-container',
}

export function surfaceClasses(surface: string): string[] {
  if (!surface || surface === 'none') return []
  if (surface === 'tertiary-container') return ['wb-bg-tertiary-container']
  if (surface === 'glow') return ['wb-surface-glow']
  if (surface === 'gradient') return ['wb-surface-gradient']
  return SURFACE_TEXT[surface]
    ? [`mat-bg-${surface}`, SURFACE_TEXT[surface]]
    : []
}

const TONES: Record<string, string> = {
  primary: 'mat-text-primary',
  secondary: 'mat-text-secondary',
  muted: 'mat-text-on-surface-variant',
  error: 'mat-text-error',
}

export function toneClass(tone: unknown): string {
  return TONES[String(tone)] ?? ''
}

export function typographyClasses(props: Props): string[] {
  const classes: string[] = []
  if (props['variant']) classes.push(`mat-font-${props['variant']}`)
  const tone = toneClass(props['tone'])
  if (tone) classes.push(tone)
  if (props['textAlign'] && props['textAlign'] !== 'start')
    classes.push(`ui-text-${props['textAlign']}`)
  return classes
}

function layoutClasses(props: Props): string[] {
  const classes: string[] = []
  if (props['gap'] !== undefined) classes.push(`ui-gap-${props['gap']}`)
  if (props['padding'] !== undefined && props['padding'] !== '0')
    classes.push(`ui-p-${props['padding']}`)
  if (props['align'] && props['align'] !== 'stretch')
    classes.push(`ui-align-${props['align']}`)
  if (props['justify'] && props['justify'] !== 'start')
    classes.push(`ui-justify-${props['justify']}`)
  classes.push(...surfaceClasses(String(props['surface'] ?? 'none')))
  if (props['corner'] && props['corner'] !== 'none')
    classes.push(`mat-corner-${props['corner']}`)
  if (props['elevation'] && props['elevation'] !== '0')
    classes.push(`mat-shadow-${props['elevation']}`)
  if (props['outlined']) classes.push('ui-outlined')
  return classes
}

function columnClasses(props: Props): string[] {
  return [
    `wb-cols-${props['columns'] ?? '1'}`,
    `wb-cols-t-${props['tabletColumns'] ?? '1'}`,
    `wb-cols-m-${props['mobileColumns'] ?? '1'}`,
  ]
}

/**
 * Classes for a block's own element. Container layout (flex/grid/gap) is applied to the element
 * that directly wraps the children; `blockLayoutClasses` returns those.
 */
export function blockClasses(block: Block): string {
  const classes = ['wb-block', `wb-el-${block.id}`, `wb-type-${block.type}`]
  for (const viewport of block.visibility.hideOn)
    classes.push(`wb-hide-${viewport}`)
  const props = block.props
  switch (block.type) {
    case 'section':
      classes.push('wb-section', ...surfaceClasses(String(props['surface'])))
      if (safeCssUrl(String(props['backgroundImage'] ?? '')))
        classes.push(
          'wb-section-image',
          props['scrim'] ? 'wb-section-scrim' : '',
        )
      if (props['corner'] && props['corner'] !== 'none')
        classes.push(`mat-corner-${props['corner']}`)
      if (props['elevation'] && props['elevation'] !== '0')
        classes.push(`mat-shadow-${props['elevation']}`)
      if (props['outlined']) classes.push('ui-outlined')
      break
    case 'heading':
    case 'text':
    case 'link':
    case 'list':
    case 'quote':
      classes.push(...typographyClasses(props))
      break
    case 'image':
    case 'video':
    case 'embed':
      if (props['corner'] && props['corner'] !== 'none')
        classes.push(`mat-corner-${props['corner']}`)
      break
    case 'button':
      if (props['fullWidth']) classes.push('ui-fill')
      break
  }
  return classes.filter(Boolean).join(' ')
}

/** Classes for the element that directly contains a container block's children. */
export function blockLayoutClasses(block: Block): string {
  const props = block.props
  switch (block.type) {
    case 'section':
      return [
        'ui-column',
        'ui-mx-auto',
        'wb-section-inner',
        `ui-max-${props['width'] === 'full' ? 'none' : props['width']}`,
        ...layoutClasses({
          ...props,
          surface: 'none',
          corner: 'none',
          elevation: '0',
          outlined: false,
        }),
      ].join(' ')
    case 'container':
      return [
        'ui-column',
        'ui-mx-auto',
        `ui-max-${props['width'] === 'full' ? 'none' : props['width']}`,
        ...layoutClasses(props),
      ].join(' ')
    case 'row':
      return [
        'ui-row',
        props['wrap'] ? 'ui-wrap' : '',
        props['stackOnMobile'] ? 'wb-stack-mobile' : '',
        ...layoutClasses(props),
      ]
        .filter(Boolean)
        .join(' ')
    case 'grid':
      return ['ui-grid', ...columnClasses(props), ...layoutClasses(props)].join(
        ' ',
      )
    case 'repeater':
      return [
        'ui-grid',
        ...columnClasses(props),
        `ui-gap-${props['gap'] ?? '4'}`,
      ].join(' ')
    case 'card':
      return [
        'ui-column',
        `ui-gap-${props['gap'] ?? '3'}`,
        props['align'] && props['align'] !== 'stretch'
          ? `ui-align-${props['align']}`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    case 'toolbar':
      return [
        'ui-row',
        'ui-align-center',
        'ui-grow',
        `ui-gap-${props['gap'] ?? '2'}`,
      ].join(' ')
    case 'dialog':
      return ['ui-column', `ui-gap-${props['gap'] ?? '4'}`].join(' ')
    case 'accordion':
    case 'tabs':
    case 'stepper':
      return ''
    default:
      return ['ui-column', ...layoutClasses(props)].join(' ')
  }
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** Theme classes for any element that should render with the project theme (site root, overlay panels). */
export function themeScopeClasses(theme: ThemeSettings): string {
  return [
    'wb-theme',
    `wb-primary-${theme.primary}`,
    `wb-tertiary-${theme.tertiary}`,
    `wb-body-${slug(theme.bodyFont)}`,
    `wb-heading-${slug(theme.headingFont)}`,
    `wb-density-${Math.abs(theme.density)}`,
    `wb-radius-${theme.radius}`,
    `wb-scheme-${theme.mode}`,
  ].join(' ')
}

/** Classes for the `.wb-site` root that hosts a rendered page (see `_site.scss`). */
export function siteThemeClasses(theme: ThemeSettings): string {
  return `wb-site ${themeScopeClasses(theme)}`
}

export function fontClassSlug(font: string): string {
  return slug(font)
}
