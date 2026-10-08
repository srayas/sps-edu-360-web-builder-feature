'use client'
import { defaultStyles } from '@/constants/builder-constants'
import { useBuilderStore } from '@/store/useBuilderStore'
import { EditorBtns, EditorElement } from '@/types/editor-elements'
import { Badge } from '@spsedu360/shared-ui/src/components/atoms/badge'
import clsx from 'clsx'
import React from 'react'
import { v4 } from 'uuid'
import RecursiveElements from './recursive-elements'
import { Trash } from 'lucide-react'

type ContainerComponentProps = {
  element: EditorElement
}
const ContainerComponent = ({ element }: ContainerComponentProps) => {
  const { id, content, name, type, styles } = element
  const { dispatch, editorState } = useBuilderStore()

  const handleOnDrop = (e: React.DragEvent, type: string) => {
    e.stopPropagation()
    const componentType = e.dataTransfer.getData('componentType') as EditorBtns
    switch (componentType) {
      case 'text':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: type,
            elementDetails: {
              content: { innerText: 'Text Element' },
              id: v4(),
              name: 'Text',
              styles: {
                color: 'black',
                ...defaultStyles,
              },
              type: 'text',
            },
          },
        })
        break
      case 'container':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: type,
            elementDetails: {
              content: [],
              id: v4(),
              name: 'Container',
              styles: { ...defaultStyles },
              type: 'container',
            },
          },
        })
        break
      case 'video':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                src: 'https://www.youtube.com/embed/5eLRm8riAnI',
              },
              id: v4(),
              name: 'Video',
              styles: {},
              type: 'video',
            },
          },
        })
        break
      case 'link':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                innerText: 'Link Text',
                href: '#',
              },
              id: v4(),
              name: 'Link',
              styles: {
                color: 'black',
                ...defaultStyles,
              },
              type: 'link',
            },
          },
        })
        break
      case '2Col':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: [
                {
                  content: [],
                  id: v4(),
                  name: 'Container',
                  type: 'container',
                  styles: { ...defaultStyles, width: '100%' },
                },
                {
                  content: [],
                  id: v4(),
                  name: 'Container',
                  type: 'container',
                  styles: { ...defaultStyles, width: '100%' },
                },
              ],
              id: v4(),
              name: 'Two Columns',
              styles: { ...defaultStyles, display: 'flex' },
              type: '2Col',
            },
          },
        })
        break
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleOnDragStart = (e: React.DragEvent, type: string) => {
    if (type === '__body') return
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
      className={clsx('relative p-4 transition-all group', {
        'max-w-full w-full':
          type === 'container' || type === '2Col' || type === '__body',
        'h-fit': type === 'container',
        'h-full overflow-y-auto':
          type === '__body' && !editorState.editor.previewMode,
        'h-[100vh] overflow-y-auto':
          type === '__body' && editorState.editor.previewMode,
        'flex flex-col md:!flex-row': type === '2Col',
        '!border-blue-500':
          editorState.editor.selectedElement.id === id &&
          !editorState.editor.previewMode &&
          editorState.editor.selectedElement.type !== '__body',
        '!border-yellow-400 !border-4':
          editorState.editor.selectedElement.id === id &&
          !editorState.editor.previewMode &&
          editorState.editor.selectedElement.type === '__body',
        '!border-solid':
          editorState.editor.selectedElement.id === id &&
          !editorState.editor.previewMode,
        'border-dashed border-[1px] border-slate-300':
          !editorState.editor.previewMode,
      })}
      onDrop={(e) => handleOnDrop(e, id)}
      onDragOver={handleDragOver}
      draggable={type !== '__body'}
      onDragStart={(e) => handleOnDragStart(e, 'container')}
      onClick={handleOnClick}
    >
      {editorState.editor.selectedElement.id === element.id &&
        !editorState.editor.previewMode && (
          <Badge
            className={clsx(
              'absolute -top-[25px] -left-[1px] rounded-none rounded-t-lg hidden',
              {
                block:
                  editorState.editor.selectedElement.id === id &&
                  !editorState.editor.previewMode,
              },
            )}
          >
            {name}
          </Badge>
        )}
      {Array.isArray(content) &&
        content.map((childElement) => (
          <RecursiveElements key={childElement.id} element={childElement} />
        ))}
      {editorState.editor.selectedElement.id === id &&
        !editorState.editor.previewMode &&
        editorState.editor.selectedElement.type !== '__body' && (
          <div
            className="absolute bg-red-300 px-2.5 py-1 text-xs font-bold -top-[25px] -right-[1px] rounded-none
            rounded-t-lg !text-white cursor-pointer"
          >
            <Trash size={16} onClick={handleDeleteElement} />
          </div>
        )}
    </div>
  )
}

export default ContainerComponent
