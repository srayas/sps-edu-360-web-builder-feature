import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  signal,
} from '@angular/core'
import { Clipboard } from '@angular/cdk/clipboard'
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog'
import { MatButtonModule } from '@angular/material/button'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatTooltipModule } from '@angular/material/tooltip'
import {
  EXAMPLE_SPEC,
  SpecMode,
  TemplateNode,
  aiPrompt,
  definition,
  parseSpec,
  specSchema,
} from '../../core/model'
import { BuilderStore } from './builder-store'

export interface ImportSpecData {
  /** Pre-filled JSON (e.g. a page copied earlier). */
  text?: string
  mode?: SpecMode
}

interface OutlineRow {
  depth: number
  icon: string
  type: string
  label: string
}

/**
 * Import from AI: copy the instruction prompt for any assistant, paste its JSON reply (or a
 * file), see what will be built with every problem explained, then add it as a page.
 */
@Component({
  selector: 'wb-import-spec-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let result = check();
    <h2 mat-dialog-title class="ui-row ui-align-center ui-gap-2">
      <mat-icon>auto_awesome</mat-icon>Import from AI / JSON
    </h2>
    <mat-dialog-content>
      <div class="wb-import-grid">
        <div class="ui-column ui-gap-3 ui-min-0">
          <div class="wb-action ui-column ui-gap-2 ui-p-3">
            <span class="mat-font-title-sm">1 · Ask your AI assistant</span>
            <span class="mat-font-body-sm mat-text-on-surface-variant"
              >Copy the prompt into ChatGPT, Claude, Gemini or Copilot, then
              attach a screenshot or Figma link of the page (or describe it).
              The prompt lists every block, option and step this builder
              supports, so the reply is ready to import.</span
            >
            <div class="ui-row ui-wrap ui-gap-2">
              <button matButton="tonal" type="button" (click)="copyPrompt()">
                <mat-icon>{{
                  copied() === 'prompt' ? 'check' : 'content_copy'
                }}</mat-icon
                >{{ copied() === 'prompt' ? 'Copied' : 'Copy AI prompt' }}
              </button>
              <button
                matButton
                type="button"
                (click)="
                  download(
                    'web-builder-ai-prompt.md',
                    prompt(),
                    'text/markdown'
                  )
                "
              >
                <mat-icon>download</mat-icon>Prompt (.md)
              </button>
              <button
                matButton
                type="button"
                matTooltip="For tools with structured output"
                (click)="
                  download(
                    'web-builder-page.schema.json',
                    schema(),
                    'application/json'
                  )
                "
              >
                <mat-icon>data_object</mat-icon>JSON schema
              </button>
            </div>
          </div>
          <div class="ui-column ui-gap-2">
            <div class="ui-row ui-align-center ui-gap-2">
              <span class="mat-font-title-sm ui-grow">2 · Paste the reply</span>
              <button matButton type="button" (click)="fileInput.click()">
                <mat-icon>upload_file</mat-icon>File
              </button>
              <button matButton type="button" (click)="useExample()">
                <mat-icon>lightbulb</mat-icon>Example
              </button>
            </div>
            <input
              #fileInput
              type="file"
              accept="application/json,.json,.md,.txt"
              class="ui-visually-hidden"
              aria-hidden="true"
              tabindex="-1"
              (change)="loadFile($event)"
            />
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Page JSON</mat-label>
              <textarea
                matInput
                class="wb-mono wb-import-text"
                spellcheck="false"
                [value]="text()"
                (input)="text.set($any($event.target).value)"
                placeholder='{ "name": "Pricing", "blocks": [ … ] }  — a whole AI reply with a json code block works too'
              ></textarea>
            </mat-form-field>
          </div>
        </div>

        <div class="ui-column ui-gap-3 ui-min-0">
          <span class="mat-font-title-sm">3 · Check</span>
          @if (!text().trim()) {
            <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
              Paste JSON to see what will be built. Problems are listed with
              their location and how they were fixed.
            </p>
          } @else {
            <div class="ui-row ui-align-center ui-gap-2 ui-wrap" role="status">
              @if (errors().length) {
                <span class="wb-badge wb-tone-error"
                  >{{ errors().length }}
                  {{ errors().length === 1 ? 'error' : 'errors' }}</span
                >
              } @else {
                <span class="wb-badge wb-tone-success">Ready to import</span>
              }
              @if (warnings().length) {
                <span class="wb-badge wb-tone-warning"
                  >{{ warnings().length }} fixed automatically</span
                >
              }
              @if (result.stats.blocks) {
                <span class="mat-font-body-sm mat-text-on-surface-variant"
                  >{{ result.stats.blocks }} blocks ·
                  {{ result.stats.actions }} steps{{
                    result.stats.sources
                      ? ' · ' + result.stats.sources + ' data sources'
                      : ''
                  }}{{
                    result.stats.workflows
                      ? ' · ' + result.stats.workflows + ' workflows'
                      : ''
                  }}</span
                >
              }
            </div>
            @if (result.issues.length) {
              <ul class="wb-import-issues ui-m-0 ui-p-0">
                @for (issue of result.issues; track $index) {
                  <li class="ui-row ui-gap-2">
                    <mat-icon
                      class="ui-icon-sm"
                      [class.mat-text-error]="issue.level === 'error'"
                      [class.wb-text-warning]="issue.level === 'warning'"
                      >{{
                        issue.level === 'error' ? 'error' : 'build'
                      }}</mat-icon
                    >
                    <span class="mat-font-body-sm">
                      @if (issue.path) {
                        <code>{{ issue.path }}</code>
                      }
                      {{ issue.message }}</span
                    >
                  </li>
                }
              </ul>
            }
            @if (outline().length) {
              <div
                class="ui-column wb-import-outline ui-outlined mat-corner-md ui-p-2"
                aria-label="What will be built"
              >
                @for (row of outline(); track $index) {
                  <span
                    class="ui-row ui-align-center ui-gap-2 mat-font-body-sm wb-import-row"
                    [attr.data-depth]="row.depth"
                  >
                    <mat-icon class="ui-icon-sm mat-text-primary">{{
                      row.icon
                    }}</mat-icon>
                    <span class="ui-shrink-0">{{ row.type }}</span>
                    <span class="mat-text-on-surface-variant ui-truncate">{{
                      row.label
                    }}</span>
                  </span>
                }
              </div>
            }
          }
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="ui-row ui-wrap ui-gap-2">
      <mat-button-toggle-group
        [value]="mode()"
        (change)="mode.set($event.value)"
        hideSingleSelectionIndicator
        aria-label="Where to put it"
      >
        <mat-button-toggle value="new">New page</mat-button-toggle>
        <mat-button-toggle value="append">Add to this page</mat-button-toggle>
        <mat-button-toggle value="replace">Replace this page</mat-button-toggle>
      </mat-button-toggle-group>
      @if (result.spec?.theme) {
        <mat-checkbox
          [checked]="applyTheme()"
          (change)="applyTheme.set($event.checked)"
          >Use its theme</mat-checkbox
        >
      }
      <span class="ui-spacer"></span>
      <button matButton type="button" mat-dialog-close>Cancel</button>
      <button
        matButton="filled"
        type="button"
        [disabled]="!result.spec || errors().length > 0"
        (click)="import()"
      >
        <mat-icon>download_done</mat-icon>Import
      </button>
    </mat-dialog-actions>
  `,
})
export class ImportSpecDialog {
  private readonly store = inject(BuilderStore)
  private readonly ref = inject(MatDialogRef<ImportSpecDialog, string>)
  private readonly clipboard = inject(Clipboard)
  private readonly document = inject(DOCUMENT)
  private readonly data = inject<ImportSpecData | null>(MAT_DIALOG_DATA, {
    optional: true,
  })

  readonly text = signal(this.data?.text ?? '')
  readonly mode = signal<SpecMode>(this.data?.mode ?? 'new')
  readonly applyTheme = signal(false)
  readonly copied = signal('')
  readonly prompt = computed(() => aiPrompt())
  readonly schema = computed(() => JSON.stringify(specSchema(), null, 2))

  readonly check = computed(() => parseSpec(this.text(), this.store.project()))
  readonly errors = computed(() =>
    this.check().issues.filter((issue) => issue.level === 'error'),
  )
  readonly warnings = computed(() =>
    this.check().issues.filter((issue) => issue.level === 'warning'),
  )
  readonly outline = computed<OutlineRow[]>(() => {
    const rows: OutlineRow[] = []
    const walk = (nodes: TemplateNode[], depth: number) => {
      for (const node of nodes) {
        if (rows.length >= 400) return
        const def = definition(node.type)
        const props = node.props ?? {}
        const label =
          node.name ??
          String(
            props['text'] ??
              props['title'] ??
              props['label'] ??
              props['value'] ??
              '',
          )
        rows.push({
          depth: Math.min(depth, 8),
          icon: def?.icon ?? 'widgets',
          type: def?.label ?? node.type,
          label: label.split('\n')[0].slice(0, 80),
        })
        walk(node.children ?? [], depth + 1)
      }
    }
    walk(this.check().spec?.blocks ?? [], 0)
    return rows
  })

  copyPrompt(): void {
    this.clipboard.copy(this.prompt())
    this.copied.set('prompt')
    setTimeout(() => this.copied.set(''), 2000)
  }

  useExample(): void {
    this.text.set(JSON.stringify(EXAMPLE_SPEC, null, 2))
  }

  async loadFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file && file.size <= 2_000_000) this.text.set(await file.text())
  }

  download(name: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = this.document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  import(): void {
    const result = this.check()
    if (!result.spec || this.errors().length) return
    const name = this.store.importSpec(
      result.spec,
      this.mode(),
      this.applyTheme(),
    )
    if (name) this.ref.close(name)
  }
}
