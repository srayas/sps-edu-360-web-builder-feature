/**
 * Ready-made sections and pages. Templates are plain trees; `instantiate` turns them into blocks
 * with fresh ids and resolves `@source:name` / `@variable:name` references to the ids of data
 * sources and variables the template creates.
 */
import { createAction, createBlock, createSource, newId } from './project'
import type {
  Action,
  Block,
  BlockLogic,
  ConditionOperator,
  DataSource,
  Expr,
  Project,
  Props,
  StyleMap,
  Trigger,
  Variable,
} from './types'

export interface TemplateNode {
  type: string
  props?: Props
  children?: TemplateNode[]
  name?: string
  actions?: [Trigger, Action['type'], string?, string?][]
  /** Reactive bindings (show/enable/require when, computed value, options, property bindings). */
  logic?: BlockLogic
  /** Optional per-block overrides (kept rare: templates should look right with the theme alone). */
  styles?: StyleMap
  tabletStyles?: StyleMap
}

export interface Template {
  id: string
  name: string
  icon: string
  description: string
  kind: 'section' | 'page'
  blocks: TemplateNode[]
  sources?: (Partial<Omit<DataSource, 'id'>> &
    Pick<DataSource, 'name' | 'kind'>)[]
  variables?: Omit<Variable, 'id'>[]
}

const n = (
  type: string,
  props: Props = {},
  children: TemplateNode[] = [],
  actions?: TemplateNode['actions'],
  name?: string,
): TemplateNode => ({ type, props, children, actions, name })

const heading = (text: string, variant = 'headline-md', extra: Props = {}) =>
  n('heading', {
    text,
    variant,
    level: variant.startsWith('display') ? '1' : '2',
    ...extra,
  })
const para = (text: string, extra: Props = {}) => n('text', { text, ...extra })
const button = (
  text: string,
  variant = 'filled',
  extra: Props = {},
  actions?: TemplateNode['actions'],
) => n('button', { text, variant, ...extra }, [], actions)
const featureCard = (icon: string, title: string, text: string) =>
  n('card', { avatar: icon, title, appearance: 'outlined' }, [
    para(text, { variant: 'body-md', tone: 'muted' }),
  ])

const header = n(
  'toolbar',
  { title: 'Brand', icon: 'bolt', surface: 'surface', sticky: true },
  [n('nav', { usePages: true, justify: 'end' }), button('Sign in', 'tonal')],
  undefined,
  'Header',
)

const hero = n(
  'section',
  { surface: 'glow', padding: '8', align: 'center' },
  [
    n('stack', { align: 'center', gap: '5' }, [
      n('badge', {
        text: 'New · Version 2.0',
        surface: 'surface-container-high',
      }),
      heading('Build beautiful apps without writing code', 'display-md', {
        textAlign: 'center',
      }),
      para(
        'Drag in Material components, connect your data and publish in minutes. Everything follows your theme automatically.',
        { textAlign: 'center', tone: 'muted' },
      ),
      n('row', { justify: 'center', gap: '3' }, [
        button('Get started', 'filled', { icon: 'arrow_forward' }),
        button('See features', 'outlined', { href: '#features' }),
      ]),
    ]),
  ],
  undefined,
  'Hero',
)

const splitHero = n(
  'section',
  { padding: '8' },
  [
    n(
      'grid',
      {
        columns: '2',
        tabletColumns: '2',
        mobileColumns: '1',
        gap: '7',
        align: 'center',
      },
      [
        n('stack', { gap: '4' }, [
          heading('Everything your team needs in one place', 'display-sm'),
          para(
            'Plan, track and ship work with a workspace that adapts to how you operate.',
            { tone: 'muted' },
          ),
          n('row', { gap: '3' }, [
            button('Start free trial'),
            button('Book a demo', 'text', { icon: 'play_circle' }),
          ]),
        ]),
        n('image', { ratio: '4-3', corner: 'xl' }),
      ],
    ),
  ],
  undefined,
  'Split hero',
)

const features = n(
  'section',
  { anchor: 'features', padding: '8' },
  [
    n('stack', { align: 'center', gap: '2' }, [
      heading('Why teams choose us', 'headline-lg', { textAlign: 'center' }),
      para('A complete toolkit, designed with Material 3.', {
        textAlign: 'center',
        tone: 'muted',
      }),
    ]),
    n(
      'grid',
      { columns: '3', tabletColumns: '2', mobileColumns: '1', gap: '5' },
      [
        featureCard(
          'bolt',
          'Fast by default',
          'Pages load quickly and stay responsive on every device.',
        ),
        featureCard(
          'palette',
          'On-brand theming',
          'One theme drives colors, type and shape across your app.',
        ),
        featureCard(
          'security',
          'Secure',
          'Inputs are validated and links are sanitised automatically.',
        ),
        featureCard(
          'dataset',
          'Connected data',
          'Bind tables, lists and charts to APIs or collections.',
        ),
        featureCard(
          'devices',
          'Responsive',
          'Grids reflow for tablet and mobile without extra work.',
        ),
        featureCard(
          'touch_app',
          'Interactive',
          'Wire up navigation, dialogs and forms with actions.',
        ),
      ],
    ),
  ],
  undefined,
  'Features',
)

const stats = n(
  'section',
  { surface: 'surface-container-low', padding: '7' },
  [
    n(
      'grid',
      { columns: '4', tabletColumns: '2', mobileColumns: '1', gap: '4' },
      [
        n('stat', {
          label: 'Active users',
          value: '12.4k',
          trend: '+18% this quarter',
          icon: 'group',
        }),
        n('stat', {
          label: 'Projects shipped',
          value: '3,210',
          trend: '+6% this month',
          icon: 'rocket_launch',
        }),
        n('stat', {
          label: 'Uptime',
          value: '99.98%',
          trend: 'Last 90 days',
          icon: 'monitor_heart',
          trendTone: 'muted',
        }),
        n('stat', {
          label: 'Satisfaction',
          value: '4.9 / 5',
          trend: '2,100 reviews',
          icon: 'star',
          trendTone: 'muted',
        }),
      ],
    ),
  ],
  undefined,
  'Statistics',
)

const pricingCard = (
  title: string,
  price: string,
  items: string,
  cta: string,
  highlight = false,
) =>
  n(
    'card',
    {
      title,
      subtitle: price,
      appearance: highlight ? 'filled' : 'outlined',
      avatar: highlight ? 'workspace_premium' : '',
    },
    [
      n('list', { items, variant: 'body-md' }),
      button(cta, highlight ? 'filled' : 'outlined', { fullWidth: true }),
    ],
  )

const pricing = n(
  'section',
  { padding: '8' },
  [
    heading('Simple, transparent pricing', 'headline-lg', {
      textAlign: 'center',
    }),
    n(
      'grid',
      {
        columns: '3',
        tabletColumns: '3',
        mobileColumns: '1',
        gap: '5',
        align: 'stretch',
      },
      [
        pricingCard(
          'Starter',
          '$0 / month',
          '1 project\nCommunity support\nBasic analytics',
          'Start free',
        ),
        pricingCard(
          'Pro',
          '$19 / month',
          'Unlimited projects\nPriority support\nAdvanced analytics\nCustom domain',
          'Upgrade to Pro',
          true,
        ),
        pricingCard(
          'Enterprise',
          'Custom',
          'SSO and audit logs\nDedicated success manager\nSLA',
          'Contact sales',
        ),
      ],
    ),
  ],
  undefined,
  'Pricing',
)

const testimonial = (quote: string, name: string, role: string) =>
  n('card', { appearance: 'filled' }, [
    n('quote', { text: quote, cite: '', variant: 'title-md' }),
    n('avatar', { name, caption: role, size: 'sm' }),
  ])

const testimonials = n(
  'section',
  { padding: '8', surface: 'surface-container-low' },
  [
    heading('Loved by teams everywhere', 'headline-lg', {
      textAlign: 'center',
    }),
    n(
      'grid',
      { columns: '3', tabletColumns: '1', mobileColumns: '1', gap: '5' },
      [
        testimonial(
          'We replaced three tools with one and our onboarding time dropped by half.',
          'Priya Nair',
          'COO, Northwind',
        ),
        testimonial(
          'The theming means every page looks like it was designed together.',
          'Marcus Lee',
          'Design lead, Contoso',
        ),
        testimonial(
          'Connecting our API took minutes. The tables just worked.',
          'Sofia Alvarez',
          'Engineer, Fabrikam',
        ),
      ],
    ),
  ],
  undefined,
  'Testimonials',
)

const faq = n(
  'section',
  { padding: '8' },
  [
    n('container', { width: 'md', gap: '5' }, [
      heading('Frequently asked questions', 'headline-lg', {
        textAlign: 'center',
      }),
      n('accordion', {}, [
        n('panel', { title: 'Can I use my own domain?' }, [
          para(
            'Yes. Publish your app and point your domain at it from the settings page.',
          ),
        ]),
        n('panel', { title: 'Is there a free plan?' }, [
          para('The Starter plan is free forever for a single project.'),
        ]),
        n('panel', { title: 'Can I export my work?' }, [
          para(
            'Export the full project as JSON or any page as static HTML at any time.',
          ),
        ]),
      ]),
    ]),
  ],
  undefined,
  'FAQ',
)

const cta = n(
  'section',
  { surface: 'gradient', padding: '8' },
  [
    n('stack', { align: 'center', gap: '4' }, [
      heading('Ready to get started?', 'headline-lg', { textAlign: 'center' }),
      para('Create your first app today. No credit card required.', {
        textAlign: 'center',
      }),
      button('Create an account', 'tonal', { icon: 'arrow_forward' }),
    ]),
  ],
  undefined,
  'Call to action',
)

const footerColumn = (title: string, links: string[]) =>
  n('stack', { gap: '2' }, [
    heading(title, 'title-sm', { level: '3' }),
    ...links.map((link) =>
      n('link', { text: link, href: '#', variant: 'body-md', tone: 'muted' }),
    ),
  ])

const footer = n(
  'section',
  { surface: 'surface-container', padding: '7' },
  [
    n(
      'grid',
      { columns: '4', tabletColumns: '2', mobileColumns: '1', gap: '5' },
      [
        n('stack', { gap: '2' }, [
          heading('Brand', 'title-lg', { level: '3' }),
          para('Material apps, built visually.', {
            variant: 'body-md',
            tone: 'muted',
          }),
        ]),
        footerColumn('Product', ['Features', 'Pricing', 'Changelog']),
        footerColumn('Company', ['About', 'Careers', 'Contact']),
        footerColumn('Legal', ['Privacy', 'Terms']),
      ],
    ),
    n('divider'),
    para('© 2026 Brand. All rights reserved.', {
      variant: 'body-sm',
      tone: 'muted',
    }),
  ],
  undefined,
  'Footer',
)

const contact = n(
  'section',
  { padding: '8' },
  [
    n('container', { width: 'sm', gap: '4' }, [
      heading('Get in touch', 'headline-lg'),
      para(
        'Tell us about your project and we will reply within one business day.',
        { tone: 'muted' },
      ),
      n(
        'form',
        { gap: '3', successMessage: 'Thanks! We will be in touch soon.' },
        [
          n(
            'grid',
            { columns: '2', tabletColumns: '2', mobileColumns: '1', gap: '3' },
            [
              n('input', { label: 'First name', required: true }),
              n('input', { label: 'Last name', required: true }),
            ],
          ),
          n('input', {
            label: 'Email',
            inputType: 'email',
            required: true,
            prefixIcon: 'mail',
          }),
          n('select', {
            label: 'Topic',
            items: 'Sales\nSupport\nPartnerships',
          }),
          n('textarea', { label: 'Message', required: true, rows: 5 }),
          n('checkbox', {
            label: 'I agree to be contacted about my request',
            required: true,
          }),
          button('Send message', 'filled', {
            htmlType: 'submit',
            icon: 'send',
          }),
        ],
      ),
    ]),
  ],
  undefined,
  'Contact form',
)

const signIn = n(
  'section',
  { padding: '8', surface: 'surface-container-low' },
  [
    n('container', { width: 'xs', gap: '4' }, [
      n(
        'card',
        { appearance: 'raised', title: 'Sign in', subtitle: 'Welcome back' },
        [
          n(
            'form',
            { gap: '3', successMessage: 'Signed in.' },
            [
              n('input', {
                label: 'Email',
                inputType: 'email',
                required: true,
                prefixIcon: 'mail',
                bind: '@variable:userEmail',
              }),
              n('input', {
                label: 'Password',
                inputType: 'password',
                required: true,
                prefixIcon: 'lock',
                minLength: 8,
              }),
              n('checkbox', { label: 'Keep me signed in' }),
              button('Sign in', 'filled', {
                htmlType: 'submit',
                fullWidth: true,
              }),
            ],
            [
              ['submit', 'setVariable', '@variable:signedIn', 'true'],
              ['submit', 'navigate', '@page:first'],
            ],
          ),
          n('row', { justify: 'between' }, [
            n('link', {
              text: 'Forgot password?',
              href: '#',
              variant: 'body-md',
            }),
            n('link', {
              text: 'Create account',
              href: '#',
              variant: 'body-md',
            }),
          ]),
        ],
      ),
    ]),
  ],
  undefined,
  'Sign-in form',
)

const dashboard = n(
  'section',
  { padding: '6' },
  [
    n('row', { justify: 'between', align: 'center' }, [
      n('stack', { gap: '1' }, [
        heading('Dashboard', 'headline-md'),
        para('Overview of the last 30 days', {
          variant: 'body-md',
          tone: 'muted',
        }),
      ]),
      button('Export', 'outlined', { icon: 'download' }),
    ]),
    n(
      'grid',
      { columns: '4', tabletColumns: '2', mobileColumns: '1', gap: '4' },
      [
        n('stat', {
          label: 'Revenue',
          value: '$48.2k',
          trend: '+8.1%',
          icon: 'payments',
        }),
        n('stat', {
          label: 'Orders',
          value: '1,204',
          trend: '+3.4%',
          icon: 'shopping_cart',
        }),
        n('stat', {
          label: 'Visitors',
          value: '32.9k',
          trend: '+12%',
          icon: 'visibility',
        }),
        n('stat', {
          label: 'Refunds',
          value: '14',
          trend: '-2%',
          icon: 'undo',
          trendTone: 'error',
        }),
      ],
    ),
    n(
      'grid',
      { columns: '2', tabletColumns: '1', mobileColumns: '1', gap: '4' },
      [
        n('card', { title: 'Revenue', subtitle: 'Monthly' }, [
          n('chart', { title: '', chartType: 'line' }),
        ]),
        n('card', { title: 'Recent activity' }, [n('data-list', {})]),
      ],
    ),
    n('card', { title: 'Team' }, [n('table', {})]),
  ],
  undefined,
  'Dashboard',
)

const products = JSON.stringify(
  [
    {
      id: 1,
      name: 'Aurora Desk Lamp',
      price: '$89',
      category: 'Lighting',
      description: 'Warm dimmable light with a slim aluminium arm.',
      image:
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 2,
      name: 'Nimbus Chair',
      price: '$249',
      category: 'Furniture',
      description: 'Ergonomic support for long working sessions.',
      image:
        'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 3,
      name: 'Fjord Mug',
      price: '$18',
      category: 'Kitchen',
      description: 'Hand-glazed stoneware that keeps coffee warm.',
      image:
        'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 4,
      name: 'Atlas Backpack',
      price: '$129',
      category: 'Travel',
      description: 'Weatherproof pack with a padded laptop sleeve.',
      image:
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    },
  ],
  null,
  2,
)

const catalogue = n(
  'section',
  { padding: '7' },
  [
    n('row', { justify: 'between', align: 'center' }, [
      heading('Products', 'headline-lg'),
      n('badge', { text: '{{data.products.length}} items' }),
    ]),
    n(
      'repeater',
      {
        source: '@source:products',
        columns: '4',
        tabletColumns: '2',
        mobileColumns: '1',
        gap: '5',
      },
      [
        n(
          'card',
          {
            appearance: 'outlined',
            title: '{{item.name}}',
            subtitle: '{{item.category}}',
            image: '{{item.image}}',
            imageAlt: '{{item.name}}',
          },
          [
            para('{{item.description}}', { variant: 'body-md', tone: 'muted' }),
            n('row', { justify: 'between', align: 'center' }, [
              heading('{{item.price}}', 'title-lg', { level: '3' }),
              button('Add to cart', 'tonal', { icon: 'add_shopping_cart' }, [
                ['click', 'incrementVariable', '@variable:cartCount', '1'],
                [
                  'click',
                  'showMessage',
                  '',
                  'Added {{item.name}} to your cart',
                ],
              ]),
            ]),
          ],
        ),
      ],
    ),
  ],
  undefined,
  'Product catalogue',
)

const tracker = n(
  'section',
  { padding: '7' },
  [
    n('stack', { gap: '1' }, [
      heading('Task tracker', 'headline-md'),
      para(
        'Add tasks with the form; they are saved to the “tasks” collection and listed in the table.',
        { tone: 'muted' },
      ),
    ]),
    {
      ...n(
        'grid',
        {
          columns: '2',
          tabletColumns: '1',
          mobileColumns: '1',
          gap: '5',
          align: 'start',
        },
        [
          n('card', { title: 'New task', avatar: 'add_task' }, [
            n(
              'form',
              { gap: '3', successMessage: 'Task added.' },
              [
                n('input', { label: 'Title', field: 'title', required: true }),
                n('select', {
                  label: 'Priority',
                  field: 'priority',
                  items: 'Low\nMedium\nHigh',
                  required: true,
                }),
                n('datepicker', { label: 'Due date', field: 'due' }),
                n('input', { label: 'Owner', field: 'owner' }),
                button('Add task', 'filled', {
                  htmlType: 'submit',
                  icon: 'add',
                  fullWidth: true,
                }),
              ],
              [['submit', 'saveToCollection', '@source:tasks']],
            ),
          ]),
          n('stack', { gap: '3' }, [
            n('table', {
              source: '@source:tasks',
              columns: 'title|Title\npriority|Priority\ndue|Due\nowner|Owner',
              pageSize: 8,
            }),
            n('row', { justify: 'end' }, [
              button('Clear all', 'text', { icon: 'delete_sweep' }, [
                ['click', 'clearCollection', '@source:tasks'],
              ]),
            ]),
          ]),
        ],
      ),
      styles: { 'grid-template-columns': 'minmax(0, 1fr) minmax(0, 2fr)' },
      tabletStyles: { 'grid-template-columns': 'minmax(0, 1fr)' },
    },
  ],
  undefined,
  'Task tracker',
)

// Reactive order form: shows what UI logic can do without code.
const when = (
  field: string,
  operator: ConditionOperator,
  value?: unknown,
): Expr => ({
  kind: 'conditions',
  group: {
    combinator: 'and',
    conditions: [
      { field: `fields.${field}`, operator, value, source: 'literal' },
    ],
  },
})
const withLogic = (node: TemplateNode, logic: BlockLogic): TemplateNode => ({
  ...node,
  logic,
})
const CITIES: Record<string, string[]> = {
  India: ['Bengaluru', 'Chennai', 'Kochi', 'Mumbai'],
  'United Kingdom': ['Edinburgh', 'London', 'Manchester'],
  'United States': ['Austin', 'New York', 'Seattle'],
}
const smartOrder = n('section', { padding: '8' }, [
  n('container', { width: 'sm', gap: '4' }, [
    heading('Place an order', 'headline-lg'),
    para(
      'Fields react to each other: company details appear for businesses, cities follow the country and the total updates as you type.',
      { tone: 'muted' },
    ),
    n('form', { gap: '3', successMessage: 'Order received — thank you!' }, [
      n('radio', {
        label: 'Customer type',
        field: 'customerType',
        items: 'Person\nBusiness',
        required: true,
      }),
      withLogic(
        n(
          'card',
          {
            appearance: 'filled',
            title: 'Company details',
            subtitle: 'Shown only for business customers',
          },
          [
            withLogic(n('input', { label: 'Company name', field: 'company' }), {
              required: when('customerType', 'eq', 'Business'),
            }),
            n('input', { label: 'VAT number', field: 'vat', hint: 'Optional' }),
          ],
          undefined,
          'Company details',
        ),
        { visible: when('customerType', 'eq', 'Business') },
      ),
      n(
        'grid',
        { columns: '2', tabletColumns: '2', mobileColumns: '1', gap: '3' },
        [
          n('select', {
            label: 'Country',
            field: 'country',
            items: Object.keys(CITIES).join('\n'),
            required: true,
          }),
          withLogic(
            n('select', {
              label: 'City',
              field: 'city',
              items: '',
              required: true,
            }),
            {
              enabled: when('country', 'not_empty'),
              options: {
                kind: 'rule',
                rule: {
                  if: [
                    ...Object.entries(CITIES).flatMap(([country, cities]) => [
                      { '==': [{ var: 'fields.country' }, country] },
                      { preserve: cities },
                    ]),
                    [],
                  ],
                },
              },
            },
          ),
        ],
      ),
      n(
        'grid',
        { columns: '3', tabletColumns: '3', mobileColumns: '1', gap: '3' },
        [
          n('input', {
            label: 'Quantity',
            field: 'qty',
            inputType: 'number',
            required: true,
          }),
          n('input', {
            label: 'Unit price',
            field: 'price',
            inputType: 'number',
            prefixIcon: 'sell',
            required: true,
          }),
          withLogic(
            n('input', {
              label: 'Total',
              field: 'total',
              prefixIcon: 'calculate',
            }),
            {
              value: {
                kind: 'rule',
                rule: {
                  round: [
                    {
                      '*': [
                        { var: 'fields.qty' },
                        { var: 'fields.price' },
                        { if: [{ var: 'fields.loyalty' }, 0.9, 1] },
                      ],
                    },
                    2,
                  ],
                },
              },
            },
          ),
        ],
      ),
      n('switch', { label: 'Apply 10% loyalty discount', field: 'loyalty' }),
      withLogic(
        n('alert', { title: 'Free shipping', text: '', severity: 'success' }),
        {
          visible: when('total', 'gte', 1000),
          props: {
            text: {
              kind: 'template',
              text: 'Orders over 1000 ship free — your total is {{fields.total}}.',
            },
          },
        },
      ),
      withLogic(
        button('Place order', 'filled', {
          htmlType: 'submit',
          icon: 'shopping_cart_checkout',
        }),
        {
          enabled: when('total', 'gt', 0),
        },
      ),
    ]),
  ]),
])

export const TEMPLATES: readonly Template[] = [
  // Sections
  {
    id: 'header',
    kind: 'section',
    name: 'Header',
    icon: 'web_asset',
    description: 'Toolbar with brand, page links and action.',
    blocks: [header],
  },
  {
    id: 'hero',
    kind: 'section',
    name: 'Hero',
    icon: 'campaign',
    description: 'Centered headline with two calls to action.',
    blocks: [hero],
  },
  {
    id: 'split-hero',
    kind: 'section',
    name: 'Split hero',
    icon: 'vertical_split',
    description: 'Copy and buttons next to an image.',
    blocks: [splitHero],
  },
  {
    id: 'features',
    kind: 'section',
    name: 'Feature grid',
    icon: 'grid_view',
    description: 'Six feature cards in a responsive grid.',
    blocks: [features],
  },
  {
    id: 'stats',
    kind: 'section',
    name: 'Statistics',
    icon: 'insights',
    description: 'Four KPI tiles.',
    blocks: [stats],
  },
  {
    id: 'pricing',
    kind: 'section',
    name: 'Pricing',
    icon: 'sell',
    description: 'Three plan cards.',
    blocks: [pricing],
  },
  {
    id: 'testimonials',
    kind: 'section',
    name: 'Testimonials',
    icon: 'reviews',
    description: 'Customer quotes.',
    blocks: [testimonials],
  },
  {
    id: 'faq',
    kind: 'section',
    name: 'FAQ',
    icon: 'quiz',
    description: 'Accordion of questions.',
    blocks: [faq],
  },
  {
    id: 'cta',
    kind: 'section',
    name: 'Call to action',
    icon: 'ads_click',
    description: 'Prominent closing band.',
    blocks: [cta],
  },
  {
    id: 'contact',
    kind: 'section',
    name: 'Contact form',
    icon: 'contact_mail',
    description: 'Validated contact form.',
    blocks: [contact],
  },
  {
    id: 'sign-in',
    kind: 'section',
    name: 'Sign-in form',
    icon: 'login',
    description: 'Email and password card.',
    blocks: [signIn],
    variables: [
      { name: 'userEmail', initial: '', persist: true },
      { name: 'signedIn', initial: 'false', persist: true },
    ],
  },
  {
    id: 'footer',
    kind: 'section',
    name: 'Footer',
    icon: 'call_to_action',
    description: 'Link columns and copyright.',
    blocks: [footer],
  },
  // Pages
  {
    id: 'page-landing',
    kind: 'page',
    name: 'Landing page',
    icon: 'rocket_launch',
    description: 'Header, hero, features, stats, testimonials, CTA and footer.',
    blocks: [header, hero, features, stats, testimonials, cta, footer],
  },
  {
    id: 'page-dashboard',
    kind: 'page',
    name: 'Dashboard',
    icon: 'space_dashboard',
    description: 'KPIs, chart, activity list and table.',
    blocks: [dashboard],
  },
  {
    id: 'page-catalogue',
    kind: 'page',
    name: 'Product catalogue',
    icon: 'storefront',
    description:
      'Repeater bound to a products data source with an add-to-cart action.',
    blocks: [header, catalogue, footer],
    sources: [
      { name: 'products', kind: 'static', json: products, url: '', path: '' },
    ],
    variables: [{ name: 'cartCount', initial: '0', persist: true }],
  },
  {
    id: 'page-tracker',
    kind: 'page',
    name: 'Task tracker',
    icon: 'checklist',
    description: 'Form that saves to a collection and a table that lists it.',
    blocks: [tracker],
    sources: [
      { name: 'tasks', kind: 'collection', json: '[]', url: '', path: '' },
    ],
  },
  {
    id: 'page-order',
    kind: 'page',
    name: 'Smart order form',
    icon: 'account_tree',
    description:
      'Conditional sections, dependent dropdowns, a computed total and a rule-driven alert.',
    blocks: [header, smartOrder, footer],
  },
  {
    id: 'page-pricing',
    kind: 'page',
    name: 'Pricing page',
    icon: 'payments',
    description: 'Header, pricing, FAQ and footer.',
    blocks: [header, pricing, faq, footer],
  },
  {
    id: 'page-contact',
    kind: 'page',
    name: 'Contact page',
    icon: 'mail',
    description: 'Header, contact form and footer.',
    blocks: [header, contact, footer],
  },
  {
    id: 'page-sign-in',
    kind: 'page',
    name: 'Sign-in page',
    icon: 'lock',
    description: 'Centered sign-in card.',
    blocks: [signIn],
    variables: [
      { name: 'userEmail', initial: '', persist: true },
      { name: 'signedIn', initial: 'false', persist: true },
    ],
  },
]

export interface ResolvedRefs {
  sources: Record<string, string>
  variables: Record<string, string>
  firstPageId: string
}

function resolve(value: string, refs: ResolvedRefs): string {
  return value
    .replace(/^@source:(\w+)$/, (_, name: string) => refs.sources[name] ?? '')
    .replace(
      /^@variable:(\w+)$/,
      (_, name: string) => refs.variables[name] ?? '',
    )
    .replace(/^@page:first$/, refs.firstPageId)
}

/** Instantiates template nodes with fresh ids, resolving template references. */
export function instantiate(
  nodes: TemplateNode[],
  refs: ResolvedRefs,
): Block[] {
  return nodes.map((node) => {
    const props: Props = {}
    for (const [key, value] of Object.entries(node.props ?? {}))
      props[key] = typeof value === 'string' ? resolve(value, refs) : value
    const block = createBlock(node.type, props, [])
    if (node.name) block.name = node.name
    else if (
      typeof props['label'] === 'string' &&
      props['label'] &&
      node.type !== 'button'
    )
      block.name = props['label'].slice(0, 60)
    block.styles = { ...(node.styles ?? {}) }
    block.tabletStyles = { ...(node.tabletStyles ?? {}) }
    block.logic = structuredClone(node.logic ?? {})
    block.children = instantiate(node.children ?? [], refs)
    block.actions = (node.actions ?? []).map(
      ([trigger, type, target = '', value = '']) =>
        createAction(trigger, type, resolve(target, refs), value),
    )
    return block
  })
}

/**
 * Adds the data sources and variables a template needs to `project` (reusing existing ones with
 * the same name) and returns the references used to instantiate the template.
 */
export function mergeTemplateData(
  project: Project,
  template: Template,
): ResolvedRefs {
  const sources: Record<string, string> = {}
  for (const source of template.sources ?? []) {
    const existing = project.dataSources.find(
      (item) => item.name === source.name,
    )
    if (existing) {
      sources[source.name] = existing.id
      continue
    }
    const created: DataSource = createSource(source.name, source.kind, source)
    project.dataSources.push(created)
    sources[source.name] = created.id
  }
  const variables: Record<string, string> = {}
  for (const variable of template.variables ?? []) {
    const existing = project.variables.find(
      (item) => item.name === variable.name,
    )
    if (existing) {
      variables[variable.name] = existing.id
      continue
    }
    const created: Variable = { ...variable, id: newId() }
    project.variables.push(created)
    variables[variable.name] = created.id
  }
  return { sources, variables, firstPageId: project.pages[0]?.id ?? '' }
}
