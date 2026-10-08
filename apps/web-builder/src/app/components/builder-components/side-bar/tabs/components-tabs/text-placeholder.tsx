import { EditorBtns } from '@/types/editor-elements'
import { TypeIcon } from 'lucide-react'
import React from 'react'

type TextPlaceHolderProps = {}
const TextPlaceholder = ({}: TextPlaceHolderProps) => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }

  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, 'text')}
      className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center cursor-pointer"
    >
      <TypeIcon size={40} className="text-muted-foreground" />
    </div>
  )
}

export default TextPlaceholder
