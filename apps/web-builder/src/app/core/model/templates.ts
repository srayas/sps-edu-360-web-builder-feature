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
  TableColumn,
  TableConfig,
  TableHeaderGroup,
  TableMerge,
  TableRowAction,
  ToneRule,
  LogicFunction,
  Workflow,
  Trigger,
  ValidationRule,
  Variable,
} from './types'

export interface TemplateNode {
  type: string
  props?: Props
  children?: TemplateNode[]
  name?: string
  /** Short form `[trigger, type, target, value]`, or a full step with options and branches. */
  actions?: ([Trigger, Action['type'], string?, string?] | TemplateAction)[]
  /** Validation rules for form fields. */
  validations?: Omit<ValidationRule, 'id'>[]
  /** Table configuration; column ids are local names referenced by merges and groups. */
  table?: TemplateTable
  /** Reactive bindings (show/enable/require when, computed value, options, property bindings). */
  logic?: BlockLogic
  /** Optional per-block overrides (kept rare: templates should look right with the theme alone). */
  styles?: StyleMap
  tabletStyles?: StyleMap
}

/** A template step: like an Action without ids; targets may use `@block:Name` references. */
export interface TemplateAction {
  trigger?: Trigger
  type: Action['type']
  target?: string
  value?: string
  options?: Record<string, string>
  onSuccess?: TemplateAction[]
  onError?: TemplateAction[]
  expr?: Expr
  branches?: TemplateAction[][]
}

export interface TemplateTable {
  /** Columns; `cellBlock: '@block:Name'` points at a "table-cell" child of the table node. */
  columns: (Omit<TableColumn, 'onChange'> & { onChange?: TemplateAction[] })[]
  rowActions?: (Omit<TableRowAction, 'actions'> & {
    actions: TemplateAction[]
  })[]
  merges?: TableMerge[]
  headerGroups?: TableHeaderGroup[]
  rowTones?: Omit<ToneRule, 'id'>[]
  emptyText?: string
}

function instantiateTable(
  table: TemplateTable,
  refs: ResolvedRefs,
): TableConfig {
  const ids = new Map<string, string>()
  const columns = table.columns.map(({ onChange, ...column }): TableColumn => {
    const id = newId()
    ids.set(column.id, id)
    return {
      ...structuredClone(column),
      id,
      ...(onChange?.length
        ? {
            onChange: onChange.map((step) =>
              templateAction(step, 'change', refs),
            ),
          }
        : {}),
    }
  })
  return {
    columns,
    rowActions: (table.rowActions ?? []).map((action) => ({
      ...structuredClone({ ...action, actions: [] }),
      id: newId(),
      actions: action.actions.map((step) =>
        templateAction(step, 'click', refs),
      ),
    })),
    merges: (table.merges ?? []).map((merge) => ({
      ...structuredClone(merge),
      id: newId(),
      column: ids.get(merge.column) ?? '',
    })),
    headerGroups: (table.headerGroups ?? []).map((group) => ({
      ...group,
      id: newId(),
      column: ids.get(group.column) ?? '',
    })),
    ...(table.rowTones
      ? {
          rowTones: table.rowTones.map((rule) => ({
            ...structuredClone(rule),
            id: newId(),
          })),
        }
      : {}),
    ...(table.emptyText ? { emptyText: table.emptyText } : {}),
  }
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
  /** Functions added to the project (skipped when one with the same name exists). */
  functions?: Omit<LogicFunction, 'id'>[]
  /** Workflows added to the project; their steps may use @source:/@workflow: references. */
  workflows?: (Omit<Workflow, 'id' | 'steps'> & { steps: TemplateAction[] })[]
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
    n(
      'form',
      { gap: '3', successMessage: '' },
      [
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
              withLogic(
                n('input', { label: 'Company name', field: 'company' }),
                {
                  required: when('customerType', 'eq', 'Business'),
                },
              ),
              n('input', {
                label: 'VAT number',
                field: 'vat',
                hint: 'Optional',
              }),
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
                    fn: [
                      'lineTotal',
                      { var: 'fields.qty' },
                      { var: 'fields.price' },
                      { if: [{ var: 'fields.loyalty' }, 0.1, 0] },
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
      ],
      [
        {
          trigger: 'submit',
          type: 'runWorkflow',
          target: '@workflow:Place order',
          options: {
            in_qty: '{{fields.qty}}',
            in_price: '{{fields.price}}',
            in_discount: '{{fields.loyalty}}',
            in_customer: '{{fields.company}}',
            saveAs: 'placed',
          },
          onSuccess: [
            {
              type: 'showMessage',
              value:
                'Total {{response.total}} + tax {{response.tax}} + shipping {{response.shipping}} = {{response.grandTotal}}',
              options: { severity: 'success', title: 'Order placed' },
            },
          ],
        },
      ],
    ),
  ]),
])

/** lineTotal(qty, price, discount) → qty × price × (1 − discount), rounded to cents. */
const lineTotalFunction: Omit<LogicFunction, 'id'> = {
  name: 'lineTotal',
  description:
    'Quantity × price, minus a discount fraction, rounded to 2 decimals.',
  params: [
    { name: 'qty' },
    { name: 'price' },
    { name: 'discount', defaultValue: '0' },
  ],
  body: {
    kind: 'rule',
    rule: {
      round: [
        {
          '*': [
            { var: 'qty' },
            { var: 'price' },
            { '-': [1, { var: 'discount' }] },
          ],
        },
        2,
      ],
    },
  },
}

/** "Place order": compute the total, then tax and shipping in parallel, and return a summary. */
const placeOrderWorkflow: Template['workflows'] = [
  {
    name: 'Place order',
    description: 'Computes the order total, then tax and shipping in parallel.',
    params: [
      { name: 'qty' },
      { name: 'price' },
      { name: 'discount', defaultValue: 'false' },
      { name: 'customer', defaultValue: 'Guest' },
    ],
    steps: [
      {
        type: 'compute',
        expr: {
          kind: 'rule',
          rule: {
            fn: [
              'lineTotal',
              { var: 'input.qty' },
              { var: 'input.price' },
              { if: [{ var: 'input.discount' }, 0.1, 0] },
            ],
          },
        },
        options: { saveAs: 'total' },
      },
      {
        type: 'parallel',
        branches: [
          [
            {
              type: 'compute',
              expr: {
                kind: 'rule',
                rule: { round: [{ '*': [{ var: 'steps.total' }, 0.18] }, 2] },
              },
              options: { saveAs: 'tax' },
            },
          ],
          [
            {
              type: 'compute',
              expr: {
                kind: 'rule',
                rule: { if: [{ '>=': [{ var: 'steps.total' }, 1000] }, 0, 50] },
              },
              options: { saveAs: 'shipping' },
            },
          ],
        ],
      },
    ],
    output: {
      kind: 'rule',
      rule: {
        object: [
          ['customer', { var: 'input.customer' }],
          ['total', { var: 'steps.total' }],
          ['tax', { var: 'steps.tax' }],
          ['shipping', { var: 'steps.shipping' }],
          [
            'grandTotal',
            {
              round: [
                {
                  '+': [
                    { var: 'steps.total' },
                    { var: 'steps.tax' },
                    { var: 'steps.shipping' },
                  ],
                },
                2,
              ],
            },
          ],
        ],
      },
    },
  },
]

// Sign-up: validation rules, API response handling, notifications, confirmation and a side sheet.
const withRules = (
  node: TemplateNode,
  validations: Omit<ValidationRule, 'id'>[],
): TemplateNode => ({ ...node, validations })
const signUp = n('section', { padding: '8', surface: 'glow' }, [
  n('container', { width: 'sm', gap: '4' }, [
    heading('Create your account', 'headline-lg'),
    para(
      'Every field validates as you type. The form posts to an API: success opens a welcome sheet, server errors appear on the fields.',
      { tone: 'muted' },
    ),
    n('card', { appearance: 'outlined' }, [
      n(
        'form',
        { gap: '3', successMessage: '' },
        [
          withRules(
            n('input', {
              label: 'Full name',
              field: 'fullName',
              required: true,
              prefixIcon: 'person',
            }),
            [
              {
                kind: 'letters',
                message: 'Use letters, spaces, apostrophes or hyphens.',
              },
              { kind: 'minLength', value: '2' },
            ],
          ),
          n(
            'grid',
            { columns: '2', tabletColumns: '2', mobileColumns: '1', gap: '3' },
            [
              withRules(
                n('input', {
                  label: 'Email',
                  field: 'email',
                  required: true,
                  prefixIcon: 'mail',
                }),
                [{ kind: 'email' }],
              ),
              withRules(
                n('input', {
                  label: 'Phone',
                  field: 'phone',
                  prefixIcon: 'call',
                  hint: 'Optional',
                }),
                [{ kind: 'phone' }],
              ),
            ],
          ),
          n(
            'grid',
            { columns: '2', tabletColumns: '2', mobileColumns: '1', gap: '3' },
            [
              withRules(
                n('input', {
                  label: 'Password',
                  field: 'password',
                  inputType: 'password',
                  required: true,
                  prefixIcon: 'lock',
                }),
                [
                  {
                    kind: 'pattern',
                    value: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$',
                    message:
                      'Use 8+ characters with upper and lower case letters and a digit.',
                  },
                ],
              ),
              withRules(
                n('input', {
                  label: 'Confirm password',
                  field: 'confirmPassword',
                  inputType: 'password',
                  required: true,
                  prefixIcon: 'lock',
                }),
                [
                  {
                    kind: 'matchField',
                    value: 'password',
                    message: 'Passwords do not match.',
                  },
                ],
              ),
            ],
          ),
          withRules(
            n('input', {
              label: 'Age',
              field: 'age',
              inputType: 'number',
              required: true,
            }),
            [
              { kind: 'integer' },
              { kind: 'min', value: '18', message: 'You must be 18 or older.' },
              { kind: 'max', value: '120' },
            ],
          ),
          withRules(
            n('checkbox', {
              label: 'I accept the terms and privacy policy',
              field: 'terms',
            }),
            [
              {
                kind: 'required',
                message: 'Please accept the terms to continue.',
              },
            ],
          ),
          n('row', { justify: 'between', gap: '3' }, [
            {
              ...button('Clear', 'text', { icon: 'restart_alt' }),
              actions: [
                {
                  trigger: 'click',
                  type: 'confirm',
                  value: 'Everything you typed will be removed.',
                  options: {
                    title: 'Clear the form?',
                    confirmLabel: 'Clear',
                    danger: 'true',
                  },
                  onSuccess: [
                    { type: 'resetForm' },
                    {
                      type: 'showMessage',
                      value: 'The form was cleared.',
                      options: { severity: 'info' },
                    },
                  ],
                },
              ],
            },
            button('Create account', 'filled', {
              htmlType: 'submit',
              icon: 'person_add',
            }),
          ]),
        ],
        [
          {
            trigger: 'submit',
            type: 'submitForm',
            target: 'https://api.example.com/signup',
            value: 'POST',
            onSuccess: [
              { type: 'openDialog', target: '@block:Welcome' },
              {
                type: 'showMessage',
                value: 'Account created for {{form.email}}.',
                options: { severity: 'success', title: 'Welcome!' },
              },
            ],
            onError: [
              {
                type: 'showMessage',
                value: '{{error.message}}',
                options: {
                  severity: 'error',
                  title: 'Could not create your account',
                  duration: '8',
                },
              },
            ],
          },
        ],
      ),
    ]),
  ]),
])
const welcomeSheet = n(
  'dialog',
  {
    title: 'Welcome aboard',
    subtitle: 'Your account is ready',
    presentation: 'side',
    size: 'sm',
  },
  [
    para(
      'Hi {{form.fullName}}, we sent a confirmation link to {{form.email}}.',
    ),
    n('alert', {
      title: 'Next step',
      text: 'Verify your email to unlock all features.',
      severity: 'info',
    }),
    button('Done', 'filled', { icon: 'check' }, [['click', 'closeDialog']]),
  ],
  undefined,
  'Welcome',
)

// Orders: a configured data table with formats, computed values, header groups, equal-value
// and conditional merges, row highlights and View / Edit / Delete row actions on a collection.
const ORDERS = JSON.stringify(
  [
    {
      id: 'o1',
      region: 'North',
      customer: 'Ada Lovelace',
      product: 'Ergonomic chair',
      qty: 2,
      price: 240,
      status: 'Paid',
      fulfilled: 100,
      date: '2026-09-02',
      priority: true,
    },
    {
      id: 'o2',
      region: 'North',
      customer: 'Grace Hopper',
      product: 'Monitor arm',
      qty: 5,
      price: 89,
      status: 'Pending',
      fulfilled: 40,
      date: '2026-09-11',
      priority: false,
    },
    {
      id: 'o3',
      region: 'North',
      customer: 'Alan Turing',
      product: 'Desk lamp',
      qty: 12,
      price: 35,
      status: 'Overdue',
      fulfilled: 10,
      date: '2026-08-21',
      priority: true,
    },
    {
      id: 'n-total',
      kind: 'subtotal',
      region: 'North',
      customer: 'Subtotal',
      product: '',
      qty: 19,
      total: 1325,
    },
    {
      id: 'o4',
      region: 'South',
      customer: 'Katherine Johnson',
      product: 'Standing desk',
      qty: 1,
      price: 610,
      status: 'Paid',
      fulfilled: 100,
      date: '2026-09-15',
      priority: false,
    },
    {
      id: 'o5',
      region: 'South',
      customer: 'Linus Torvalds',
      product: 'Keyboard',
      qty: 3,
      price: 129,
      status: 'Pending',
      fulfilled: 65,
      date: '2026-09-19',
      priority: false,
    },
    {
      id: 's-total',
      kind: 'subtotal',
      region: 'South',
      customer: 'Subtotal',
      product: '',
      qty: 4,
      total: 997,
    },
  ],
  null,
  2,
)
const isSubtotal = (negate = false): Expr => ({
  kind: 'conditions',
  group: {
    combinator: 'and',
    conditions: [
      {
        field: 'row.kind',
        operator: negate ? 'neq' : 'eq',
        value: 'subtotal',
        source: 'literal',
      },
    ],
  },
})
const statusIs = (status: string): Expr => ({
  kind: 'conditions',
  group: {
    combinator: 'and',
    conditions: [
      { field: 'row.status', operator: 'eq', value: status, source: 'literal' },
    ],
  },
})
type TemplateColumn = TemplateTable['columns'][number]
const column = (
  id: string,
  field: string,
  header: string,
  extra: Partial<TemplateColumn> = {},
): TemplateColumn => ({
  id,
  field,
  header,
  format: 'text',
  align: 'start',
  sortable: false,
  ...extra,
})
const ordersTable: TemplateNode = {
  ...n(
    'table',
    {
      source: '@source:orders',
      filter: true,
      paginate: true,
      pageSize: 10,
      sortable: true,
    },
    [
      // A custom cell: blocks designed on the canvas, repeated per row with {{row}}.
      n(
        'table-cell',
        { gap: '1' },
        [
          button('Remind', 'tonal', { icon: 'notifications_active' }, [
            {
              trigger: 'click',
              type: 'showMessage',
              value:
                'Reminder sent to {{row.customer}} about the {{row.product}}.',
              options: { severity: 'info', title: 'Follow-up' },
            },
          ]),
        ],
        undefined,
        'Cell · Follow-up',
      ),
    ],
    undefined,
    'Orders table',
  ),
  table: {
    columns: [
      column('region', 'region', 'Region', { mergeEqual: true, width: 'sm' }),
      column('customer', 'customer', 'Customer', { format: 'avatar' }),
      column('product', 'product', 'Product'),
      column('qty', 'qty', 'Qty', {
        format: 'number',
        align: 'end',
        cell: 'number',
        cellWhen: isSubtotal(true),
        autoSave: true,
        validations: [
          { id: 'q1', kind: 'required', message: 'Enter a quantity.' },
          { id: 'q2', kind: 'integer' },
          { id: 'q3', kind: 'min', value: '1', message: 'At least 1.' },
          {
            id: 'q4',
            kind: 'max',
            value: '99',
            message: 'At most 99 per order.',
          },
        ],
      }),
      column('price', 'price', 'Price', {
        format: 'currency',
        align: 'end',
        formatOptions: { currency: 'USD' },
      }),
      column('total', '', 'Total', {
        format: 'currency',
        align: 'end',
        formatOptions: { currency: 'USD', decimals: '0' },
        value: {
          kind: 'rule',
          rule: {
            if: [
              { var: 'row.total' },
              { var: 'row.total' },
              { '*': [{ var: 'row.qty' }, { var: 'row.price' }] },
            ],
          },
        },
        tones: [
          {
            id: 't1',
            tone: 'success',
            when: { kind: 'rule', rule: { '>=': [{ var: 'value' }, 1000] } },
          },
        ],
      }),
      column('status', 'status', 'Status', {
        format: 'badge',
        tones: [
          { id: 's1', tone: 'success', when: statusIs('Paid') },
          { id: 's2', tone: 'warning', when: statusIs('Pending') },
          { id: 's3', tone: 'error', when: statusIs('Overdue') },
        ],
      }),
      column('fulfilled', 'fulfilled', 'Fulfilment', { format: 'progress' }),
      column('priority', 'priority', 'Priority', {
        align: 'center',
        cell: 'checkbox',
        cellWhen: isSubtotal(true),
        autoSave: true,
        onChange: [
          {
            type: 'showMessage',
            value: 'Priority updated for {{row.customer}}’s order.',
            options: { severity: 'success' },
          },
        ],
      }),
      column('followUp', '', 'Follow-up', {
        cell: 'blocks',
        cellBlock: '@block:Cell · Follow-up',
        cellWhen: {
          kind: 'rule',
          rule: { in: [{ var: 'row.status' }, ['Pending', 'Overdue']] },
        },
      }),
      column('date', 'date', 'Ordered', { format: 'date' }),
    ],
    headerGroups: [
      { id: 'g1', label: 'Order', column: 'customer', span: 2 },
      { id: 'g2', label: 'Amount', column: 'qty', span: 3 },
    ],
    merges: [
      {
        id: 'm1',
        column: 'customer',
        colspan: 2,
        rowspan: 1,
        when: isSubtotal(),
      },
    ],
    rowTones: [
      { tone: 'muted', when: isSubtotal() },
      { tone: 'error', when: statusIs('Overdue') },
    ],
    rowActions: [
      {
        id: 'view',
        label: 'View',
        icon: 'visibility',
        display: 'icon',
        visible: isSubtotal(true),
        actions: [{ type: 'openDialog', target: '@block:Order details' }],
      },
      {
        id: 'edit',
        label: 'Edit',
        icon: 'edit',
        display: 'icon',
        visible: isSubtotal(true),
        actions: [{ type: 'openDialog', target: '@block:Edit order' }],
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'delete',
        display: 'icon',
        danger: true,
        visible: isSubtotal(true),
        actions: [
          {
            type: 'confirm',
            value: 'Delete the order from {{row.customer}}?',
            options: {
              title: 'Delete order',
              confirmLabel: 'Delete',
              danger: 'true',
            },
            onSuccess: [
              {
                type: 'deleteRecord',
                target: '@source:orders',
                value: '{{row.id}}',
                onSuccess: [
                  {
                    type: 'showMessage',
                    value: 'Order deleted.',
                    options: { severity: 'success' },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
}
const ordersSection = n('section', { padding: '7' }, [
  n('container', { width: 'xl', gap: '4' }, [
    heading('Orders', 'headline-lg'),
    para(
      'Regions merge automatically, subtotal rows span two columns, overdue orders are highlighted and every row can be viewed, edited or deleted.',
      { tone: 'muted' },
    ),
    ordersTable,
  ]),
])
const orderDetails = n(
  'dialog',
  {
    title: 'Order {{row.id}}',
    subtitle: '{{row.customer}} · {{row.region}}',
    presentation: 'bottom',
    size: 'md',
  },
  [
    para(
      '{{row.qty}} × {{row.product}} at {{row.price}} each, ordered on {{row.date}}.',
    ),
    n('alert', {
      title: 'Status: {{row.status}}',
      text: 'Fulfilment {{row.fulfilled}}% complete.',
      severity: 'info',
    }),
  ],
  undefined,
  'Order details',
)
const editOrder = n(
  'dialog',
  {
    title: 'Edit order',
    subtitle: '{{row.customer}}',
    presentation: 'side',
    size: 'sm',
  },
  [
    n(
      'form',
      { gap: '3', successMessage: '' },
      [
        withRules(
          n('input', {
            label: 'Customer',
            field: 'customer',
            required: true,
            defaultValue: '{{row.customer}}',
          }),
          [{ kind: 'minLength', value: '2' }],
        ),
        n('input', {
          label: 'Product',
          field: 'product',
          required: true,
          defaultValue: '{{row.product}}',
        }),
        n(
          'grid',
          { columns: '2', tabletColumns: '2', mobileColumns: '2', gap: '3' },
          [
            withRules(
              n('input', {
                label: 'Quantity',
                field: 'qty',
                inputType: 'number',
                required: true,
                defaultValue: '{{row.qty}}',
              }),
              [{ kind: 'integer' }, { kind: 'min', value: '1' }],
            ),
            withRules(
              n('input', {
                label: 'Price',
                field: 'price',
                inputType: 'number',
                required: true,
                defaultValue: '{{row.price}}',
              }),
              [{ kind: 'number' }, { kind: 'min', value: '0' }],
            ),
          ],
        ),
        n('select', {
          label: 'Status',
          field: 'status',
          items: 'Paid\nPending\nOverdue',
          defaultValue: '{{row.status}}',
        }),
        button('Save changes', 'filled', {
          htmlType: 'submit',
          icon: 'save',
          fullWidth: true,
        }),
      ],
      [
        {
          trigger: 'submit',
          type: 'updateRecord',
          target: '@source:orders',
          value: '{{row.id}}',
          onSuccess: [
            { type: 'closeDialog' },
            {
              type: 'showMessage',
              value: 'Order for {{form.customer}} updated.',
              options: { severity: 'success' },
            },
          ],
        },
      ],
    ),
  ],
  undefined,
  'Edit order',
)

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
    functions: [lineTotalFunction],
    workflows: placeOrderWorkflow,
  },
  {
    id: 'page-signup',
    kind: 'page',
    name: 'Sign-up with validation',
    icon: 'how_to_reg',
    description:
      'Validation rules, API success and error handling, notifications, a confirmation and a side sheet.',
    blocks: [header, signUp, welcomeSheet, footer],
  },
  {
    id: 'page-orders',
    kind: 'page',
    name: 'Orders table (CRUD)',
    icon: 'table_view',
    description:
      'Configured data table: formats, computed totals, merged cells, highlights and View / Edit / Delete row actions.',
    blocks: [header, ordersSection, orderDetails, editOrder, footer],
    sources: [
      { name: 'orders', kind: 'collection', json: ORDERS, url: '', path: '' },
    ],
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
  workflows?: Record<string, string>
}

function resolve(value: string, refs: ResolvedRefs): string {
  return value
    .replace(/^@source:(\w+)$/, (_, name: string) => refs.sources[name] ?? '')
    .replace(
      /^@variable:(\w+)$/,
      (_, name: string) => refs.variables[name] ?? '',
    )
    .replace(/^@page:first$/, refs.firstPageId)
    .replace(
      /^@workflow:(.+)$/,
      (_, name: string) => refs.workflows?.[name] ?? '',
    )
}

/** Instantiates template nodes with fresh ids, resolving template references. */
function templateAction(
  step: TemplateAction,
  trigger: Trigger,
  refs: ResolvedRefs,
): Action {
  const action = createAction(
    step.trigger ?? trigger,
    step.type,
    resolve(step.target ?? '', refs),
    step.value ?? '',
  )
  if (step.options) action.options = { ...step.options }
  if (step.expr) action.expr = structuredClone(step.expr)
  if (step.branches?.length)
    action.branches = step.branches.map((branch) =>
      branch.map((child) => templateAction(child, action.trigger, refs)),
    )
  if (step.onSuccess?.length)
    action.onSuccess = step.onSuccess.map((child) =>
      templateAction(child, action.trigger, refs),
    )
  if (step.onError?.length)
    action.onError = step.onError.map((child) =>
      templateAction(child, action.trigger, refs),
    )
  return action
}

/** Replaces `@block:Name` action targets with the ids of the instantiated blocks. */
function resolveBlockRefs(blocks: Block[]): Block[] {
  const ids = new Map<string, string>()
  const index = (list: Block[]) =>
    list.forEach((block) => {
      if (!ids.has(block.name)) ids.set(block.name, block.id)
      index(block.children)
    })
  index(blocks)
  const fix = (actions: Action[]) =>
    actions.forEach((action) => {
      if (action.target.startsWith('@block:'))
        action.target = ids.get(action.target.slice(7)) ?? ''
      if (action.onSuccess) fix(action.onSuccess)
      if (action.onError) fix(action.onError)
      action.branches?.forEach(fix)
    })
  const walk = (list: Block[]) =>
    list.forEach((block) => {
      fix(block.actions)
      block.table?.rowActions.forEach((action) => fix(action.actions))
      block.table?.columns.forEach((column) => {
        if (column.onChange) fix(column.onChange)
        // Custom cells name their holder (a "table-cell" child of this table) with @block:Name.
        if (column.cellBlock?.startsWith('@block:')) {
          const name = column.cellBlock.slice(7)
          column.cellBlock = block.children.find(
            (child) => child.type === 'table-cell' && child.name === name,
          )?.id
          if (!column.cellBlock) delete column.cellBlock
        }
      })
      walk(block.children)
    })
  walk(blocks)
  return blocks
}

export function instantiate(
  nodes: TemplateNode[],
  refs: ResolvedRefs,
): Block[] {
  return resolveBlockRefs(instantiateNodes(nodes, refs))
}

function instantiateNodes(nodes: TemplateNode[], refs: ResolvedRefs): Block[] {
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
    block.children = instantiateNodes(node.children ?? [], refs)
    block.actions = (node.actions ?? []).map((entry) =>
      Array.isArray(entry)
        ? createAction(
            entry[0],
            entry[1],
            resolve(entry[2] ?? '', refs),
            entry[3] ?? '',
          )
        : templateAction(entry, 'click', refs),
    )
    if (node.validations?.length)
      block.validations = node.validations.map((rule) => ({
        ...structuredClone(rule),
        id: newId(),
      }))
    if (node.table) block.table = instantiateTable(node.table, refs)
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
  for (const fn of template.functions ?? []) {
    if ((project.functions ?? []).some((item) => item.name === fn.name))
      continue
    ;(project.functions ??= []).push({ ...structuredClone(fn), id: newId() })
  }
  const refs: ResolvedRefs = {
    sources,
    variables,
    firstPageId: project.pages[0]?.id ?? '',
    workflows: {},
  }
  for (const workflow of template.workflows ?? []) {
    const existing = (project.workflows ?? []).find(
      (item) => item.name === workflow.name,
    )
    if (existing) {
      refs.workflows![workflow.name] = existing.id
      continue
    }
    const id = newId()
    refs.workflows![workflow.name] = id
    ;(project.workflows ??= []).push({
      ...structuredClone({ ...workflow, steps: [] }),
      id,
      steps: [],
    })
  }
  // Steps are created after every workflow has an id, so workflows can run each other.
  for (const workflow of template.workflows ?? []) {
    const target = project.workflows?.find(
      (item) => item.id === refs.workflows![workflow.name],
    )
    if (target && !target.steps.length)
      target.steps = workflow.steps.map((step) =>
        templateAction(step, 'click', refs),
      )
  }
  return refs
}
