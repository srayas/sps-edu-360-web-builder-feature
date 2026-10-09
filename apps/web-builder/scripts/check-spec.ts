/**
 * Checks page spec files the same way the builder's "Import from AI / JSON" dialog does.
 *   pnpm --filter @spsedu360/web-builder spec:check docs/ai/examples/team-dashboard.page.json
 * Exit code 1 when any file has errors (warnings are repaired on import).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseSpec } from '../src/app/core/model'

const base = process.env['INIT_CWD'] ?? process.cwd()
const files = process.argv.slice(2)
if (!files.length) {
  console.error('Usage: spec:check <page.json> [more.json…]')
  process.exit(2)
}
let failed = false
for (const file of files) {
  const result = parseSpec(readFileSync(resolve(base, file), 'utf8'))
  const errors = result.issues.filter((issue) => issue.level === 'error')
  const s = result.stats
  console.log(
    `${errors.length ? '✖' : '✔'} ${file} — ${s.blocks} blocks, ${s.actions} steps, ${s.sources} sources, ${s.workflows} workflows, ${s.functions} functions`,
  )
  for (const issue of result.issues)
    console.log(
      `  ${issue.level === 'error' ? 'error  ' : 'fixed  '} ${issue.path || '(spec)'}: ${issue.message}`,
    )
  failed ||= errors.length > 0
}
process.exit(failed ? 1 : 0)
