import { useBuilderStore } from '@/store/useBuilderStore'
import { EditorBtns, EditorElement } from '@/types/editor-elements'
import { Badge } from '@spsedu360/shared-ui/src/components/atoms/badge'
import clsx from 'clsx'
import { Trash } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type LinkComponentsProps = {
  element: EditorElement
}
const LinkComponent = ({ element }: LinkComponentsProps) => {
  const { dispatch, editorState } = useBuilderStore()

  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }

  const handleOnClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: 'CHANGE_CLICKED_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }
  const styles = element.styles

  const handleDeleteElement = () => {
    dispatch({
      type: 'DELETE_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }
  return (
    <div
      style={styles}
      draggable
      onDragStart={(e) => handleDragStart(e, 'text')}
      onClick={handleOnClick}
      className={clsx(
        'p-[2px] w-full m-[5px] relative text-[16px] transition-all',
        {
          '!border-blue-500':
            editorState.editor.selectedElement.id === element.id,
          '!border-solid': editorState.editor.selectedElement.id === element.id,
          'border-dashed border-[1px] border-slate-300':
            !editorState.editor.previewMode,
        },
      )}
    >
      {editorState.editor.selectedElement.id === element.id &&
        !editorState.editor.previewMode && (
          <Badge className="absolute -top-[23px] -left-[1px] rounded-none rounded-t-lg">
            {editorState.editor.selectedElement.name}
          </Badge>
        )}
      {!Array.isArray(element.content) &&
        (editorState.editor.previewMode || editorState.editor.liveMode) && (
          <Link href={element.content.href || '#'}>
            {element.content.innerText}
          </Link>
        )}
      {!editorState.editor.previewMode && (
        <span
          contentEditable={!editorState.editor.previewMode}
          suppressContentEditableWarning
          onBlur={(e) => {
            const spanElement = e.target as HTMLSpanElement
            dispatch({
              type: 'UPDATE_ELEMENT',
              payload: {
                elementDetails: {
                  ...element,
                  content: {
                    innerText: spanElement.innerHTML,
                  },
                },
              },
            })
          }}
        >
          {!Array.isArray(element.content) && element.content.innerText}
        </span>
      )}
      {editorState.editor.selectedElement.id === element.id &&
        !editorState.editor.previewMode && (
          <div
            className="absolute bg-red-300 px-2.5 py-1 text-xs font-bold -top-[25px]
                    -right-[1px] rounded-none rounded-t-lg !text-white"
          >
            <Trash
              size={16}
              className="cursor-pointer"
              onClick={handleDeleteElement}
            />
          </div>
        )}
    </div>
  )
}

export default LinkComponent
