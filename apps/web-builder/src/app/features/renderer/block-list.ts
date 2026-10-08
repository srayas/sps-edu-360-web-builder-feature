import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
} from '@angular/core'
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  DragDropModule,
} from '@angular/cdk/drag-drop'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { Block, Scope, definition, isContainer } from '../../core/model'
import {
  DragData,
  EDITOR_BRIDGE,
  listId,
} from '../../core/runtime/editor-bridge'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { BlockView } from './block-view'
import { BlockSkeleton } from './block-skeleton'

/**
 * Renders a list of sibling blocks. While editing it is a CDK drop list whose items are framed
 * so they can be selected and dragged; otherwise it renders the blocks directly.
 */
@Component({
  selector: 'wb-block-list',
  imports: [
    DragDropModule,
    MatIconModule,
    MatButtonModule,
    forwardRef(() => BlockView),
    BlockSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  template: `
    @if (editing()) {
      <div
        cdkDropList
        [id]="id()"
        [cdkDropListConnectedTo]="editor!.connectedLists()"
        [cdkDropListOrientation]="orientation()"
        [cdkDropListEnterPredicate]="canEnter"
        (cdkDropListDropped)="dropped($event)"
        [class]="layoutClass() + ' wb-drop-list'"
        [class.wb-drop-empty]="!blocks().length"
        [attr.data-parent]="parentType()"
      >
        @for (block of blocks(); track block.id) {
          <div
            cdkDrag
            [cdkDragData]="drag(block)"
            class="wb-frame"
            [class.wb-frame-selected]="editor!.selectedId() === block.id"
            [class.wb-frame-container]="container(block)"
            [class.wb-frame-hidden]="!runtime.isVisible(block)"
            (click)="select($event, block)"
            (keydown.enter)="select($event, block)"
            tabindex="0"
            [attr.aria-label]="block.name + ' block'"
          >
            <div class="wb-frame-label mat-font-label-sm" cdkDragHandle>
              <mat-icon aria-hidden="true">drag_indicator</mat-icon
              ><span class="ui-truncate">{{ block.name }}</span>
            </div>
            <wb-block
              [block]="block"
              [scope]="scope()"
              [depth]="depth()"
              [disabled]="disabled()"
            />
            <div *cdkDragPlaceholder class="wb-drop-placeholder"></div>
          </div>
        } @empty {
          <button
            mat-button
            type="button"
            class="wb-empty-drop"
            (click)="quickAdd($event)"
          >
            <mat-icon>add</mat-icon
            >{{
              parentId() === 'root'
                ? 'Drag blocks or templates here'
                : 'Drop blocks here'
            }}
          </button>
        }
      </div>
    } @else {
      <div [class]="layoutClass()">
        @for (block of blocks(); track block.id; let index = $index) {
          @if (progressive() && index >= 2) {
            <!-- Below-the-fold sections render when they approach the viewport or the browser is idle. -->
            @defer (on viewport; on idle) {
              <wb-block
                [block]="block"
                [scope]="scope()"
                [depth]="depth()"
                [disabled]="disabled()"
              />
            } @placeholder {
              <wb-block-skeleton
                class="wb-defer-placeholder"
                [type]="block.type"
                [label]="block.name"
              />
            }
          } @else {
            <wb-block
              [block]="block"
              [scope]="scope()"
              [depth]="depth()"
              [disabled]="disabled()"
            />
          }
        }
      </div>
    }
  `,
})
export class BlockList {
  readonly blocks = input.required<Block[]>()
  readonly parentId = input('root')
  readonly parentType = input('root')
  readonly layoutClass = input('ui-column')
  readonly scope = input.required<Scope>()
  readonly depth = input(0)
  /** Disabled by a containing block's logic; passed on to every child. */
  readonly disabled = input(false)
  /** Lists inside repeated rows are read-only copies. */
  readonly readonly = input(false)

  readonly runtime = inject(SiteRuntime)
  readonly editor = inject(EDITOR_BRIDGE, { optional: true })
  readonly editing = computed(
    () => !!this.editor && this.runtime.mode() === 'edit' && !this.readonly(),
  )
  /** Root of a running page: render the first sections immediately and the rest progressively. */
  readonly progressive = computed(
    () => this.parentId() === 'root' && this.runtime.mode() !== 'edit',
  )
  readonly id = computed(() => listId(this.parentId()))
  readonly orientation = computed(() =>
    ['row', 'grid', 'repeater', 'toolbar'].includes(this.parentType())
      ? 'mixed'
      : 'vertical',
  )

  constructor() {
    const editor = this.editor
    if (editor) {
      let registered = ''
      effect(() => {
        if (registered) editor.unregisterList(registered)
        registered = this.editing() ? this.id() : ''
        if (registered) editor.registerList(registered, this.depth())
      })
      inject(DestroyRef).onDestroy(() => {
        if (registered) editor.unregisterList(registered)
      })
    }
  }

  readonly canEnter = (drag: CdkDrag<DragData>, drop: CdkDropList): boolean =>
    !!this.editor?.canDrop(
      drag.data,
      this.parentId(),
      drop.element.nativeElement.dataset['parent'] ?? this.parentType(),
    )

  container(block: Block): boolean {
    return isContainer(block.type)
  }

  drag(block: Block): DragData {
    return { kind: 'move', id: block.id, type: block.type }
  }

  dropped(event: CdkDragDrop<unknown, unknown, DragData>): void {
    this.editor?.drop(event.item.data, this.parentId(), event.currentIndex)
  }

  select(event: Event, block: Block): void {
    event.stopPropagation()
    if ((event.target as HTMLElement).closest('a[href]')) event.preventDefault()
    this.editor?.select(block.id)
  }

  quickAdd(event: Event): void {
    event.stopPropagation()
    this.editor?.quickAdd(this.parentId())
  }

  label(type: string): string {
    return definition(type)?.label ?? type
  }
}
