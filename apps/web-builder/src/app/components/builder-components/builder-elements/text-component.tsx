'use client'
import { useBuilderStore } from '@/store/useBuilderStore'
import { EditorElement } from '@/types/editor-elements'
import clsx from 'clsx'
import React from 'react'
import { Badge } from '@spsedu360/shared-ui/src/components/atoms/badge'
import { Trash } from 'lucide-react'

type TextComponentProps = {
  element: EditorElement
}
const TextComponent = ({ element }: TextComponentProps) => {
  const { dispatch, editorState } = useBuilderStore()

  const handleDeleteElement = () => {
    dispatch({
      type: 'DELETE_ELEMENT',
      payload: { elementDetails: element },
    })
  }

  const styles = element.styles

  const handleOnClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: 'CHANGE_CLICKED_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }

  return (
    <div
      draggable
      style={styles}
      className={clsx(
        'p-[2px] w-full m-[5px] relative text-[16px] transition-all',
        {
          '!border-blue-500':
            editorState.editor.selectedElement.id == element.id,
          '!border-solid': editorState.editor.selectedElement.id === element.id,
          'border-dashed border-[1px] border-slate-300':
            !editorState.editor.previewMode,
        },
      )}
      onClick={handleOnClick}
    >
      {editorState.editor.selectedElement.id === element.id &&
        !editorState.editor.previewMode && (
          <Badge className="absolute -top-[23px] -left-[1px] rounded-none rounded-t-lg">
            {editorState.editor.selectedElement.name}
          </Badge>
        )}
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
                  innerText: spanElement.innerText,
                },
              },
            },
          })
        }}
      >
        {!Array.isArray(element.content) && element.content.innerText}
      </span>
      {editorState.editor.selectedElement.id === element.id &&
        !editorState.editor.previewMode && (
          <div
            className="absolute bg-red-300 px-2.5 py-1 text-xs font-bold -top-[25px] -right-[1px] rounded-none
            rounded-t-lg !text-white"
          >
            <Trash
              className="cursor-pointer"
              size={16}
              onClick={handleDeleteElement}
            />
          </div>
        )}
    </div>
  )
}

export default TextComponent
