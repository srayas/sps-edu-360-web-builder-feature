import { InjectionToken, Signal } from '@angular/core'

export type DragData =
  | { kind: 'new'; type: string }
  | { kind: 'template'; templateId: string }
  | { kind: 'move'; id: string; type: string }

/**
 * What the renderer needs from the studio while editing. The published app renders without it,
 * which keeps the renderer free of any studio dependency.
 */
export interface EditorBridge {
  readonly selectedId: Signal<string>
  /** Drop list ids ordered deepest first, so nested lists win over their parents. */
  readonly connectedLists: Signal<string[]>
  select(id: string): void
  canDrop(data: DragData, parentId: string, parentType: string): boolean
  drop(data: DragData, parentId: string, index: number): void
  registerList(id: string, depth: number): void
  unregisterList(id: string): void
  /** Quick-add from an empty drop zone. */
  quickAdd(parentId: string): void
}

export const EDITOR_BRIDGE = new InjectionToken<EditorBridge>('EDITOR_BRIDGE')

export const listId = (parentId: string): string => `wb-list-${parentId}`
