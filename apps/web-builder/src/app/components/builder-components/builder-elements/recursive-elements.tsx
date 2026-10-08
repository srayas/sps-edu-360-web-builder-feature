'use client'
import { EditorElement } from '@/types/editor-elements'
import React, { useEffect } from 'react'
import TextComponent from './text-component'
import ContainerComponent from './container-component'
import VideoComponent from './video-component'
import LinkComponent from './link-component'
import TwoColumns from './two-columns'

type RecursiveElementProps = {
  element: EditorElement
}
const RecursiveElements = ({ element }: RecursiveElementProps) => {
  useEffect(() => {
    console.log('element', element)
  }, [element])
  switch (element.type) {
    case 'text':
      return <TextComponent element={element} />
    case '__body':
    case 'container':
      return <ContainerComponent element={element} />
    case 'video':
      return <VideoComponent element={element} />
    case 'link':
      return <LinkComponent element={element} />
    case '2Col':
      return <TwoColumns element={element} />
    default:
      return null
  }
}

export default RecursiveElements
