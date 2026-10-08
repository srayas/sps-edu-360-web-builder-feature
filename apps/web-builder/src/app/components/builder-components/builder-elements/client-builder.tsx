'use client'
import { useBuilderStore } from '@/store/useBuilderStore'
import React, { useEffect } from 'react'
import RecursiveElements from './recursive-elements'

interface ClientBuilderProps {
  liveMode?: boolean
}

const ClientBuilder = ({ liveMode }: ClientBuilderProps) => {
  const { editorState, dispatch } = useBuilderStore()

  useEffect(() => {
    if (liveMode) {
      dispatch({
        type: 'TOGGLE_LIVE_MODE',
        payload: { value: true },
      })
    } else {
      dispatch({
        type: 'TOGGLE_LIVE_MODE',
        payload: { value: false },
      })
    }
  }, [liveMode])

  useEffect(() => {
    console.log(editorState)
  }, [editorState])

  return (
    <>
      {Array.isArray(editorState.editor.elements) &&
        editorState.editor.elements.map((childElement) => (
          <RecursiveElements key={childElement.id} element={childElement} />
        ))}
    </>
  )
}

export default ClientBuilder
