/**
 * Writes the AI assistant kit from the live block registry:
 *   docs/ai/PROMPT.md, docs/ai/page.schema.json, docs/ai/examples/contact.page.json
 *   .claude/skills/web-builder-page-json/references/{PROMPT.md,page.schema.json}
 * Run with `pnpm --filter @spsedu360/web-builder ai:docs` after changing blocks or steps.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { EXAMPLE_SPEC, aiPrompt, specSchema } from '../src/app/core/model'

const root = resolve(process.cwd(), '../..')
const write = (path: string, content: string) => {
  const file = join(root, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`)
  console.log('wrote', path)
}
const prompt = aiPrompt()
const schema = JSON.stringify(specSchema(), null, 2)
write('docs/ai/PROMPT.md', prompt)
write('docs/ai/page.schema.json', schema)
write(
  'docs/ai/examples/contact.page.json',
  JSON.stringify(EXAMPLE_SPEC, null, 2),
)
write('.claude/skills/web-builder-page-json/references/PROMPT.md', prompt)
write(
  '.claude/skills/web-builder-page-json/references/page.schema.json',
  schema,
)
