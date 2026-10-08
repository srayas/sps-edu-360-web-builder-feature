import { EditorBtns } from '@/types/editor-elements'
import React from 'react'

const ContainerPlaceholder = () => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }
  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, 'container')}
      className="h-14 w-14 bg-muted/70 rounded-lg p-2 flex flex-row gap-[4px] cursor-pointer"
    >
      <div className="border-dashed border-[1px] h-full rounded-sm bg-muted border-muted-foreground w-full"></div>
    </div>
  )
}

export default ContainerPlaceholder
