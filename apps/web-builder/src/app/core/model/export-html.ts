/**
 * Static HTML export of a single page. Produces semantic, accessible markup that keeps the
 * builder's theme classes, so the exported file looks like the page in the studio. Interactive
 * behaviour (actions, live data, dialogs) needs the published app; the export renders initial
 * state and static data instead.
 */
import { interpolate, lines, lookup, truthy, type Scope } from './expressions'
import { safeUrl } from './urls'
import {
  blockClasses,
  blockCss,
  blockLayoutClasses,
  siteThemeClasses,
  surfaceClasses,
} from './styles'
import type { Block, Page, Project } from './types'

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  )

export interface ExportContext {
  project: Project
  page: Page
  rows: Record<string, Record<string, unknown>[]>
  scope: Scope
}

const p = (block: Block, key: string, scope: Scope) =>
  escapeHtml(interpolate(block.props[key], scope))
const attr = (block: Block, extra = '') =>
  `class="${escapeHtml(`${blockClasses(block)} ${extra}`.trim())}"${block.props['anchor'] ? ` id="${escapeHtml(block.props['anchor'])}"` : ''}`

function visible(block: Block, ctx: ExportContext): boolean {
  const rule = block.visibility
  if (!rule.variable) return true
  const variable = ctx.project.variables.find(
    (item) => item.id === rule.variable,
  )
  const value = variable
    ? lookup(ctx.scope, `vars.${variable.name}`)
    : undefined
  const match = rule.equals
    ? String(value ?? '') === rule.equals
    : truthy(value)
  return rule.negate ? !match : match
}

function rowsFor(
  block: Block,
  ctx: ExportContext,
): Record<string, unknown>[] | undefined {
  const source = String(block.props['source'] ?? '')
  return source ? (ctx.rows[source] ?? []) : undefined
}

function children(block: Block, ctx: ExportContext, scope: Scope): string {
  return block.children.map((child) => exportBlock(child, ctx, scope)).join('')
}

function field(block: Block, scope: Scope, control: string): string {
  const required = block.props['required']
    ? ' <span aria-hidden="true">*</span>'
    : ''
  const hint = block.props['hint']
    ? `<small class="mat-text-on-surface-variant">${p(block, 'hint', scope)}</small>`
    : ''
  return `<label ${attr(block, 'wb-export-field')}><span>${p(block, 'label', scope)}${required}</span>${control}${hint}</label>`
}

export function exportBlock(
  block: Block,
  ctx: ExportContext,
  scope: Scope = ctx.scope,
): string {
  if (!visible(block, ctx)) return ''
  const s = (key: string) => p(block, key, scope)
  const state = `${block.props['required'] ? ' required' : ''}${block.props['disabled'] ? ' disabled' : ''}`
  const name = escapeHtml(block.props['field'] || block.id)
  const inner = (tag = 'div') =>
    `<${tag} class="${escapeHtml(blockLayoutClasses(block))}">${children(block, ctx, scope)}</${tag}>`
  switch (block.type) {
    case 'section':
      return `<section ${attr(block)}>${inner()}</section>`
    case 'container':
    case 'row':
    case 'stack':
    case 'grid':
      return `<div ${attr(block)}>${inner()}</div>`
    case 'card': {
      const image = safeUrl(interpolate(block.props['image'], scope), true)
      const header = block.props['title']
        ? `<header class="ui-column ui-gap-1"><h3 class="mat-font-title-lg ui-m-0">${s('title')}</h3>${block.props['subtitle'] ? `<p class="mat-font-body-md mat-text-on-surface-variant ui-m-0">${s('subtitle')}</p>` : ''}</header>`
        : ''
      return `<article ${attr(block, `wb-export-card wb-card-${block.props['appearance']}`)}>${image ? `<img src="${escapeHtml(image)}" alt="${s('imageAlt')}" class="wb-card-media">` : ''}<div class="ui-column ui-gap-3 ui-p-4">${header}${inner()}</div></article>`
    }
    case 'toolbar':
      return `<header ${attr(block, `ui-row ui-align-center ui-gap-3 ui-px-4 wb-export-toolbar`)}>${block.props['title'] ? `<strong class="mat-font-title-lg">${s('title')}</strong>` : ''}${inner()}</header>`
    case 'repeater': {
      const rows = rowsFor(block, ctx) ?? []
      const limit = Number(block.props['limit']) || rows.length
      if (!rows.length)
        return `<p ${attr(block, 'mat-text-on-surface-variant')}>${s('emptyText')}</p>`
      return `<div ${attr(block)}><div class="${escapeHtml(blockLayoutClasses(block))}">${rows
        .slice(0, limit)
        .map(
          (item, index) =>
            `<div class="ui-column">${children(block, ctx, { ...scope, item, index })}</div>`,
        )
        .join('')}</div></div>`
    }
    case 'tabs':
    case 'accordion':
    case 'stepper':
      return `<div ${attr(block, 'ui-column ui-gap-2')}>${block.children.map((child) => exportBlock(child, ctx, scope)).join('')}</div>`
    case 'tab':
    case 'panel':
    case 'step': {
      const title = escapeHtml(
        interpolate(block.props['label'] ?? block.props['title'], scope),
      )
      return `<details ${attr(block, 'wb-export-details')}${block.type !== 'panel' || block.props['expanded'] ? ' open' : ''}><summary class="mat-font-title-md">${title}</summary>${inner()}</details>`
    }
    case 'dialog':
      return ''
    case 'heading': {
      const level = /^[1-6]$/.test(String(block.props['level']))
        ? block.props['level']
        : '2'
      return `<h${level} ${attr(block)}>${s('text')}</h${level}>`
    }
    case 'text':
      return `<p ${attr(block, 'ui-pre-line')}>${s('text')}</p>`
    case 'image': {
      const src = safeUrl(interpolate(block.props['src'], scope), true)
      if (!src) return ''
      const img = `<img ${attr(block, `wb-ratio-${block.props['ratio']} wb-fit-${block.props['fit']}`)} src="${escapeHtml(src)}" alt="${s('alt')}" loading="lazy">`
      return block.props['caption']
        ? `<figure class="ui-m-0 ui-column ui-gap-2">${img}<figcaption class="mat-font-body-sm mat-text-on-surface-variant">${s('caption')}</figcaption></figure>`
        : img
    }
    case 'video':
    case 'audio': {
      const src = safeUrl(interpolate(block.props['src'], scope), true)
      return src
        ? `<${block.type} ${attr(block, 'ui-fill')} controls src="${escapeHtml(src)}" aria-label="${s('label')}"></${block.type}>`
        : ''
    }
    case 'embed': {
      const src = safeUrl(String(block.props['src']), true)
      return src.startsWith('https://')
        ? `<iframe ${attr(block, `wb-ratio-${block.props['ratio']} ui-fill`)} src="${escapeHtml(src)}" title="${s('title')}" sandbox="allow-scripts allow-same-origin allow-popups" loading="lazy" referrerpolicy="no-referrer"></iframe>`
        : ''
    }
    case 'button': {
      const href = safeUrl(String(block.props['href']))
      const label = `${block.props['icon'] ? `<span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(block.props['icon'])}</span>` : ''}${block.props['variant'] === 'icon' ? '' : s('text')}`
      const classes = `wb-export-button wb-button-${block.props['variant']}`
      return href
        ? `<a ${attr(block, classes)} href="${escapeHtml(href)}"${block.props['variant'] === 'icon' ? ` aria-label="${s('text')}"` : ''}>${label}</a>`
        : `<button ${attr(block, classes)} type="${escapeHtml(block.props['htmlType'])}"${state}>${label}</button>`
    }
    case 'link':
      return `<a ${attr(block)} href="${escapeHtml(safeUrl(String(block.props['href'])) || '#')}"${block.props['newTab'] ? ' target="_blank" rel="noopener"' : ''}>${s('text')}</a>`
    case 'icon':
      return `<span ${attr(block, `material-symbols-outlined wb-icon-${block.props['size']}`)} ${block.props['label'] ? `role="img" aria-label="${s('label')}"` : 'aria-hidden="true"'}>${escapeHtml(block.props['icon'])}</span>`
    case 'list': {
      const tag = block.props['ordered'] ? 'ol' : 'ul'
      return `<${tag} ${attr(block)}>${lines(
        interpolate(block.props['items'], scope),
      )
        .map(([item]) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</${tag}>`
    }
    case 'quote':
      return `<figure ${attr(block, 'wb-quote ui-m-0')}><blockquote class="ui-m-0">${s('text')}</blockquote>${block.props['cite'] ? `<figcaption class="mat-font-body-md mat-text-on-surface-variant">${s('cite')}</figcaption>` : ''}</figure>`
    case 'code':
      return `<pre ${attr(block, 'wb-code mat-bg-surface-container-high mat-corner-md ui-p-4')}><code>${s('text')}</code></pre>`
    case 'chips':
      return `<div ${attr(block, 'ui-row ui-wrap ui-gap-2')}>${lines(
        block.props['items'],
      )
        .map(
          ([chip]) => `<span class="wb-export-chip">${escapeHtml(chip)}</span>`,
        )
        .join('')}</div>`
    case 'avatar': {
      const src = safeUrl(interpolate(block.props['src'], scope), true)
      const initials = escapeHtml(
        String(interpolate(block.props['name'], scope))
          .split(/\s+/)
          .map((word) => word[0] ?? '')
          .join('')
          .slice(0, 2)
          .toUpperCase(),
      )
      return `<div ${attr(block, 'ui-row ui-align-center ui-gap-3')}>${src ? `<img class="wb-avatar wb-avatar-${block.props['size']}" src="${escapeHtml(src)}" alt="">` : `<span class="wb-avatar wb-avatar-${block.props['size']} mat-bg-primary-container mat-text-on-primary-container">${initials}</span>`}<span class="ui-column"><strong class="mat-font-title-sm">${s('name')}</strong><span class="mat-font-body-sm mat-text-on-surface-variant">${s('caption')}</span></span></div>`
    }
    case 'divider':
      return `<hr ${attr(block, 'wb-export-divider')}>`
    case 'spacer':
      return `<div ${attr(block, `wb-spacer-${block.props['size']}`)} aria-hidden="true"></div>`
    case 'nav':
    case 'nav-list':
    case 'breadcrumbs':
    case 'menu': {
      const links = block.props['usePages']
        ? ctx.project.pages
            .filter((page) => page.inNav)
            .map((page) => [page.name, `${page.slug}.html`])
        : lines(block.props['items'])
      const vertical = block.type === 'nav-list'
      return `<nav ${attr(block, `${vertical ? 'ui-column' : 'ui-row ui-wrap ui-align-center'} ui-gap-3`)} aria-label="${escapeHtml(block.name)}">${links.map(([label, href]) => `<a href="${escapeHtml(safeUrl(href ?? '') || '#')}">${escapeHtml(label)}</a>`).join(block.type === 'breadcrumbs' ? '<span aria-hidden="true">›</span>' : '')}</nav>`
    }
    case 'form':
      return `<form ${attr(block)}>${inner('div')}</form>`
    case 'input':
      return field(
        block,
        scope,
        `<input name="${name}" type="${escapeHtml(block.props['inputType'])}" placeholder="${s('placeholder')}"${state}>`,
      )
    case 'textarea':
      return field(
        block,
        scope,
        `<textarea name="${name}" rows="${Number(block.props['rows']) || 4}" placeholder="${s('placeholder')}"${state}></textarea>`,
      )
    case 'datepicker':
      return field(block, scope, `<input name="${name}" type="date"${state}>`)
    case 'timepicker':
      return field(block, scope, `<input name="${name}" type="time"${state}>`)
    case 'chip-input':
    case 'autocomplete':
      return field(block, scope, `<input name="${name}" type="text"${state}>`)
    case 'file':
      return field(
        block,
        scope,
        `<input name="${name}" type="file" accept="${escapeHtml(block.props['accept'])}"${block.props['multiple'] ? ' multiple' : ''}${state}>`,
      )
    case 'select':
      return field(
        block,
        scope,
        `<select name="${name}"${block.props['multiple'] ? ' multiple' : ''}${state}>${lines(
          block.props['items'],
        )
          .map(
            ([label, value]) =>
              `<option value="${escapeHtml(value ?? label)}">${escapeHtml(label)}</option>`,
          )
          .join('')}</select>`,
      )
    case 'checkbox':
    case 'switch':
      return `<label ${attr(block, 'ui-row ui-align-center ui-gap-2')}><input type="checkbox" name="${name}"${state}${block.type === 'switch' ? ' role="switch"' : ''}><span>${s('label')}</span></label>`
    case 'radio':
    case 'toggle-group':
      return `<fieldset ${attr(block, 'wb-export-fieldset')}><legend>${s('label')}</legend><div class="ui-row ui-wrap ui-gap-3">${lines(
        block.props['items'],
      )
        .map(
          ([label, value]) =>
            `<label class="ui-row ui-align-center ui-gap-1"><input type="radio" name="${name}" value="${escapeHtml(value ?? label)}"${state}>${escapeHtml(label)}</label>`,
        )
        .join('')}</div></fieldset>`
    case 'slider':
      return field(
        block,
        scope,
        `<input type="range" name="${name}" min="${Number(block.props['min'])}" max="${Number(block.props['max'])}" step="${Number(block.props['step']) || 1}" value="${Number(block.props['value'])}"${state}>`,
      )
    case 'calendar':
      return field(block, scope, `<input type="date" name="${name}">`)
    case 'table': {
      const rows = rowsFor(block, ctx)
      let header: string[]
      let body: string[][]
      if (rows) {
        const columns = lines(block.props['columns'])
        const keys = columns.length
          ? columns.map(([key]) => key)
          : Object.keys(rows[0] ?? {})
        header = columns.length
          ? columns.map(([key, label]) => label || key)
          : keys
        body = rows.map((row) =>
          keys.map((key) => String(lookup(row, key) ?? '')),
        )
      } else {
        const [first = [], ...rest] = lines(block.props['items'])
        header = first
        body = rest
      }
      return `<div ${attr(block, 'wb-table-scroll')}><table class="wb-export-table"><thead><tr>${header.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    }
    case 'data-list': {
      const rows = rowsFor(block, ctx)
      const items = rows
        ? rows.map((row) => [
            String(lookup(row, String(block.props['titleField'])) ?? ''),
            String(lookup(row, String(block.props['subtitleField'])) ?? ''),
          ])
        : lines(block.props['items'])
      return `<ul ${attr(block, 'wb-export-list')}>${items.map(([title, subtitle]) => `<li><strong>${escapeHtml(title)}</strong>${subtitle ? `<br><span class="mat-text-on-surface-variant">${escapeHtml(subtitle)}</span>` : ''}</li>`).join('')}</ul>`
    }
    case 'stat':
      return `<article ${attr(block, `wb-export-card wb-card-${block.props['appearance']} ui-column ui-gap-1 ui-p-4`)}><span class="mat-font-label-lg mat-text-on-surface-variant">${s('label')}</span><strong class="mat-font-headline-md">${s('value')}</strong><span class="mat-font-body-sm">${s('trend')}</span></article>`
    case 'chart': {
      const data = lines(block.props['items'])
        .map(
          ([label, value]) =>
            `<li>${escapeHtml(label)}: ${escapeHtml(value)}</li>`,
        )
        .join('')
      return `<figure ${attr(block, 'ui-m-0')}><figcaption class="mat-font-title-md">${s('title')}</figcaption><ul>${data}</ul></figure>`
    }
    case 'progress': {
      const value = Math.max(
        0,
        Math.min(100, Number(interpolate(block.props['value'], scope)) || 0),
      )
      return `<label ${attr(block, 'ui-column ui-gap-1')}><span>${s('label')}</span><progress max="100" value="${value}" class="ui-fill"></progress></label>`
    }
    case 'alert':
      return `<div ${attr(block, `wb-alert wb-alert-${block.props['severity']} ui-row ui-gap-3 ui-p-4 mat-corner-md`)} role="status"><div class="ui-column ui-gap-1">${block.props['title'] ? `<strong>${s('title')}</strong>` : ''}<span>${s('text')}</span></div></div>`
    case 'badge':
      return `<span ${attr(block, `wb-badge mat-corner-sm ${surfaceClasses(String(block.props['surface'])).join(' ')}`)}>${s('text')}</span>`
    default:
      return ''
  }
}

export function exportPage(
  project: Project,
  page: Page,
  rows: Record<string, Record<string, unknown>[]>,
  themeCss: string,
): string {
  const vars: Record<string, string> = {}
  for (const variable of project.variables)
    vars[variable.name] = variable.initial
  const data: Record<string, unknown[]> = {}
  for (const source of project.dataSources)
    data[source.name] = rows[source.id] ?? []
  const scope: Scope = {
    vars,
    data,
    page: { name: page.name, slug: page.slug },
    app: { name: project.name },
  }
  const ctx: ExportContext = { project, page, rows, scope }
  const body = page.blocks.map((block) => exportBlock(block, ctx)).join('\n')
  const css =
    themeCss.replace(/<\/style/gi, '') + page.blocks.map(blockCss).join('')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(page.title || page.name)} · ${escapeHtml(project.name)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
<style>${css}</style>
</head>
<body>
<div class="${escapeHtml(siteThemeClasses(project.theme))} wb-export">
<main>
${body}
</main>
</div>
</body>
</html>`
}
