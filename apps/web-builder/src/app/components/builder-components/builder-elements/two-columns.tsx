'use client'

import { defaultStyles } from '@/constants/builder-constants'
import { useBuilderStore } from '@/store/useBuilderStore'
import { EditorBtns, EditorElement } from '@/types/editor-elements'
import clsx from 'clsx'
import { Trash } from 'lucide-react'
import { v4 } from 'uuid'
import RecursiveElements from './recursive-elements'
import { Badge } from '@spsedu360/shared-ui/src/components/atoms/badge'
import { useEffect } from 'react'

type TwoColumnsProps = {
  element: EditorElement
}

const TwoColumns = ({ element }: TwoColumnsProps) => {
  const { id, content, type } = element
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
              content: { innerText: 'Text Component' },
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
            containerId: id,
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
      case '2Col':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: [],
              id: v4(),
              name: 'Two Columns',
              styles: { ...defaultStyles },
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
  const handleDragStart = (e: React.DragEvent, type: string) => {
    if (type === '__body') return
    e.dataTransfer.setData('componentType', type)
  }

  const handleDeleteElement = () => {
    dispatch({
      type: 'DELETE_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }

  const handleOnClickBody = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log(element)
    updateSelectedElementName()
  }

  const updateElementName = () => {
    if (!Array.isArray(element.content)) {
      dispatch({
        type: 'UPDATE_ELEMENT',
        payload: {
          elementDetails: { ...element, name: 'container' },
        },
      })
    }
  }

  const updateSelectedElementName = () => {
    if (
      !Array.isArray(editorState.editor.selectedElement.content) &&
      element.id === editorState.editor.selectedElement.id
    ) {
      dispatch({
        type: 'CHANGE_CLICKED_ELEMENT',
        payload: {
          elementDetails: { ...element, name: 'container' },
        },
      })
    } else {
      dispatch({
        type: 'CHANGE_CLICKED_ELEMENT',
        payload: {
          elementDetails: element,
        },
      })
    }
  }

  useEffect(() => {
    if (!Array.isArray(element.content)) {
      updateElementName()
    }
  }, [editorState])

  return (
    <div
      style={element.styles}
      className={clsx('relative p-4 transition-all', {
        'h-fit': type === 'container',
        'h-full overflow-y-auto':
          type === '__body' && !editorState.editor.previewMode,
        'h-[100vh] overflow-y-auto':
          type === '__body' && editorState.editor.previewMode,
        'm-4': type === 'container',
        '!border-blue-500':
          editorState.editor.selectedElement.id === element.id &&
          !editorState.editor.previewMode,
        '!border-solid':
          editorState.editor.selectedElement.id === element.id &&
          !editorState.editor.previewMode,
        'border-dashed border-[1px] border-slate-300':
          !editorState.editor.previewMode,
      })}
      id="innerContainer"
      onDrop={(e) => handleOnDrop(e, id)}
      onDragOver={handleDragOver}
      draggable={type !== '__body'}
      onClick={handleOnClickBody}
      onDragStart={(e) => handleDragStart(e, 'container')}
    >
      {editorState.editor.selectedElement.id === element.id &&
        !editorState.editor.previewMode && (
          <Badge className="absolute -top-[23px] -left-[1px] rounded-none rounded-t-lg">
            {editorState.editor.selectedElement.name}
          </Badge>
        )}
      {Array.isArray(content) &&
        content.map((childElement) => (
          <RecursiveElements key={childElement.id} element={childElement} />
        ))}
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

export default TwoColumns
