import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatListModule } from '@angular/material/list'
import { MatMenuModule } from '@angular/material/menu'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatDividerModule } from '@angular/material/divider'
import { ConfirmService } from '@spsedu360/shared-ui'
import { ACTION_DEFINITIONS, TEMPLATES } from '../../core/model'
import { BuilderStore } from './builder-store'
import { ActionEditor } from './action-editor'

@Component({
  selector: 'wb-pages-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatDividerModule,
    ActionEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let page = store.page();
    <div class="ui-column ui-gap-3 ui-p-3">
      <div class="ui-row ui-align-center ui-gap-2">
        <h2 class="mat-font-title-md ui-m-0 ui-grow">Pages</h2>
        <button matButton="tonal" type="button" [matMenuTriggerFor]="newPage">
          <mat-icon>add</mat-icon>New page
        </button>
        <mat-menu #newPage="matMenu">
          <button mat-menu-item (click)="store.addPage()">
            <mat-icon>note_add</mat-icon><span>Blank page</span>
          </button>
          @for (template of pageTemplates; track template.id) {
            <button mat-menu-item (click)="store.addPage(template)">
              <mat-icon>{{ template.icon }}</mat-icon
              ><span>{{ template.name }}</span>
            </button>
          }
        </mat-menu>
      </div>
      <mat-nav-list class="wb-page-list" aria-label="Pages">
        @for (item of store.project().pages; track item.id) {
          <button
            mat-list-item
            type="button"
            [activated]="item.id === page.id"
            (click)="store.selectPage(item.id)"
          >
            <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ item.name }}</span>
            <span matListItemLine
              >/{{ item.slug }}
              @if (!item.inNav) {
                · hidden from navigation
              }
            </span>
          </button>
        }
      </mat-nav-list>
      <mat-divider />
      <h3 class="mat-font-title-sm ui-m-0">Page settings</h3>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Name</mat-label>
        <input
          matInput
          [value]="page.name"
          (input)="store.updatePage({ name: $any($event.target).value })"
        />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Browser title</mat-label>
        <input
          matInput
          [value]="page.title"
          (input)="store.updatePage({ title: $any($event.target).value })"
        />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Address</mat-label>
        <span matTextPrefix>/</span>
        <input
          matInput
          [value]="page.slug"
          (change)="slugError.set(store.setSlug($any($event.target).value))"
        />
        @if (slugError()) {
          <mat-hint class="mat-text-error">{{ slugError() }}</mat-hint>
        } @else {
          <mat-hint>Lowercase letters, numbers and hyphens</mat-hint>
        }
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Navigation icon</mat-label>
        <mat-icon matPrefix>{{ page.icon }}</mat-icon>
        <input
          matInput
          [value]="page.icon"
          (input)="store.updatePage({ icon: $any($event.target).value })"
        />
      </mat-form-field>
      <mat-slide-toggle
        [checked]="page.inNav"
        (change)="store.updatePage({ inNav: $event.checked })"
        >Show in navigation</mat-slide-toggle
      >
      <div class="ui-row ui-wrap ui-gap-1">
        <button
          matIconButton
          type="button"
          matTooltip="Move up"
          aria-label="Move page up"
          (click)="store.movePage(-1)"
        >
          <mat-icon>arrow_upward</mat-icon>
        </button>
        <button
          matIconButton
          type="button"
          matTooltip="Move down"
          aria-label="Move page down"
          (click)="store.movePage(1)"
        >
          <mat-icon>arrow_downward</mat-icon>
        </button>
        <button
          matIconButton
          type="button"
          matTooltip="Duplicate page"
          aria-label="Duplicate page"
          (click)="store.duplicatePage()"
        >
          <mat-icon>file_copy</mat-icon>
        </button>
        <span class="ui-spacer"></span>
        <button
          matButton
          type="button"
          [disabled]="store.project().pages.length < 2"
          (click)="remove()"
        >
          <mat-icon>delete_outline</mat-icon>Delete page
        </button>
      </div>
      <mat-divider />
      <div class="ui-row ui-align-center">
        <h3 class="mat-font-title-sm ui-m-0 ui-grow">When the page opens</h3>
        <button matButton type="button" [matMenuTriggerFor]="loadMenu">
          <mat-icon>add</mat-icon>Action
        </button>
        <mat-menu #loadMenu="matMenu">
          @for (type of loadActions; track type.type) {
            <button mat-menu-item (click)="store.addPageAction(type.type)">
              <mat-icon>{{ type.icon }}</mat-icon
              ><span>{{ type.label }}</span>
            </button>
          }
        </mat-menu>
      </div>
      @for (
        action of page.actions;
        track action.id;
        let index = $index;
        let last = $last
      ) {
        <wb-action-editor
          [action]="action"
          [index]="index"
          [last]="last"
          [pageLevel]="true"
        />
      } @empty {
        <p class="mat-font-body-sm mat-text-on-surface-variant ui-m-0">
          For example: reload a data source or set a variable.
        </p>
      }
    </div>
  `,
})
export class PagesPanel {
  readonly store = inject(BuilderStore)
  private readonly confirm = inject(ConfirmService)
  readonly slugError = signal('')
  readonly pageTemplates = TEMPLATES.filter(
    (template) => template.kind === 'page',
  )
  readonly loadActions = ACTION_DEFINITIONS.filter(
    (action) =>
      !['submitForm', 'saveToCollection', 'resetForm', 'closeDialog'].includes(
        action.type,
      ),
  )

  async remove(): Promise<void> {
    const page = this.store.page()
    if (
      await this.confirm.confirm({
        title: `Delete “${page.name}”?`,
        message:
          'The page and all of its blocks will be removed. You can undo this.',
        confirmText: 'Delete',
        destructive: true,
      })
    ) {
      this.store.deletePage()
    }
  }
}
