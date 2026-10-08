import { EditorAction } from '@/types/editor-actions'
import {
  EditorElement,
  EditorState,
  HistoryState,
  View,
} from '@/types/editor-elements'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BuilderStoreState {
  view: View
  setView: (value: View) => void
  editorState: EditorState
  dispatch: (action: EditorAction) => void
}

const initialEditorState: EditorState['editor'] = {
  elements: [
    {
      content: [],
      id: '__body',
      name: 'Body',
      styles: {},
      type: '__body',
    },
  ],
  selectedElement: {
    id: '',
    content: [],
    name: '',
    styles: {},
    type: null,
  },
  view: 'monitor',
  previewMode: false,
  liveMode: false,
}

const initialHistoryState: HistoryState = {
  history: [initialEditorState],
  currentIndex: 0,
}

const initialState: EditorState = {
  editor: initialEditorState,
  history: initialHistoryState,
}

const addAnElement = (
  editorArray: EditorElement[],
  action: EditorAction,
): EditorElement[] => {
  if (action.type != 'ADD_ELEMENT')
    throw Error(
      'You sent the wrong action type to the Add element editor state',
    )
  return editorArray.map((item) => {
    if (item.id === action.payload.containerId && Array.isArray(item.content)) {
      return {
        ...item,
        content: [...item.content, action.payload.elementDetails],
      }
    } else if (item.content && Array.isArray(item.content)) {
      return {
        ...item,
        content: addAnElement(item.content, action),
      }
    }
    return item
  })
}

const updateAnElement = (
  editorArray: EditorElement[],
  action: EditorAction,
): EditorElement[] => {
  if (action.type != 'UPDATE_ELEMENT') {
    throw Error('You sent the wrong action type to update the element state')
  }
  return editorArray.map((item) => {
    if (item.id === action.payload.elementDetails.id) {
      return { ...item, ...action.payload.elementDetails }
    } else if (item.content && Array.isArray(item.content)) {
      return {
        ...item,
        content: updateAnElement(item.content, action),
      }
    }
    return item
  })
}

const deleteAnElement = (
  editorArray: EditorElement[],
  action: EditorAction,
): EditorElement[] => {
  if (action.type !== 'DELETE_ELEMENT') {
    throw Error('You have sent wrong action type to delete element state')
  }
  return editorArray.filter((item) => {
    if (item.id === action.payload.elementDetails.id) {
      return false
    } else if (item.content && Array.isArray(item.content)) {
      item.content = deleteAnElement(item.content, action)
    }
    return true
  })
}

const editorReducer = (
  state: EditorState = initialState,
  action: EditorAction,
): EditorState => {
  switch (action.type) {
    case 'ADD_ELEMENT':
      const updateEditorState = {
        ...state.editor,
        elements: addAnElement(state.editor.elements, action),
      }
      const updatedHistory = [
        ...state.history.history.slice(0, state.history.currentIndex + 1),
        { ...updateEditorState },
      ]
      const newEditorState = {
        ...state,
        editor: updateEditorState,
        history: {
          ...state.history,
          history: updatedHistory,
          currentIndex: updatedHistory.length - 1,
        },
      }
      return newEditorState

    case 'CHANGE_CLICKED_ELEMENT':
      const clickedState = {
        ...state,
        editor: {
          ...state.editor,
          selectedElement: action.payload.elementDetails || {
            id: '',
            name: '',
            content: [],
            styles: {},
            type: null,
          },
        },
        history: {
          ...state.history,
          history: [
            ...state.history.history.slice(0, state.history.currentIndex + 1),
            { ...state.editor },
          ],
          currentIndex: state.history.currentIndex + 1,
        },
      }
      return clickedState

    case 'CHANGE_VIEW':
      const changedViewState = {
        ...state,
        editor: {
          ...state.editor,
          view: action.payload.view,
        },
      }
      return changedViewState

    case 'DELETE_ELEMENT':
      const updateElementAfterDelete = deleteAnElement(
        state.editor.elements,
        action,
      )
      const updatedEditorStateAfterDelete = {
        ...state.editor,
        elements: updateElementAfterDelete,
      }
      const updatedHistoryAfterDelete = [
        ...state.history.history.slice(0, state.history.currentIndex + 1),
        { ...updatedEditorStateAfterDelete },
      ]
      const newStateAfterDelete = {
        ...state,
        editor: updatedEditorStateAfterDelete,
        history: {
          ...state.history,
          history: updatedHistoryAfterDelete,
          currentIndex: updatedHistoryAfterDelete.length - 1,
        },
      }
      return newStateAfterDelete

    case 'LOAD_DATA':
      return {
        ...initialState,
        editor: {
          ...initialState.editor,
          elements: action.payload.elements || initialEditorState.elements,
          liveMode: !action.payload.withLive,
        },
      }

    case 'REDO':
      if (state.history.currentIndex < state.history.history.length - 1) {
        const nextIndex = state.history.currentIndex + 1
        const nextEditorState = { ...state.history.history[nextIndex] }
        const redoState = {
          ...state,
          editor: nextEditorState,
          history: {
            ...state.history,
            currentIndex: nextIndex,
          },
        }
        return redoState
      }
      return state

    case 'TOGGLE_LIVE_MODE':
      const toggleLiveMode = {
        ...state,
        editor: {
          ...state.editor,
          liveMode: action.payload
            ? action.payload.value
            : !state.editor.liveMode,
        },
      }
      return toggleLiveMode

    case 'TOGGLE_PREVIEW_MODE':
      const toggleState = {
        ...state,
        editor: {
          ...state.editor,
          previewMode: action.payload
            ? action.payload.value
            : !state.editor.previewMode,
        },
      }
      return toggleState
    case 'UNDO':
      if (state.history.currentIndex > 0) {
        const prevIndex = state.history.currentIndex - 1
        const prevEditorState = { ...state.history.history[prevIndex] }
        const undoState = {
          ...state,
          editor: prevEditorState,
          history: {
            ...state.history,
            currentIndex: prevIndex,
          },
        }
        return undoState
      }
      return state

    case 'UPDATE_ELEMENT':
      const updatedElement = updateAnElement(state.editor.elements, action)
      const updateElementSelected =
        state.editor.selectedElement.id === action.payload.elementDetails.id
      const updateEditorWithSelected = {
        ...state.editor,
        elements: updatedElement,
        selectedElement: updateElementSelected
          ? action.payload.elementDetails
          : {
              id: '',
              content: [],
              name: '',
              styles: {},
              type: null,
            },
      }
      const updatedHistoryWithUpdate = [
        ...state.history.history.slice(0, state.history.currentIndex + 1),
        { ...updateEditorWithSelected },
      ]
      const updatedEditor = {
        ...state,
        editor: updateEditorWithSelected,
        history: {
          ...state.history,
          history: updatedHistoryWithUpdate,
          currentIndex: updatedHistoryWithUpdate.length - 1,
        },
      }

      return updatedEditor
    default:
      return state
  }
}

export const useBuilderStore = create<BuilderStoreState>()(
  persist(
    (set) => ({
      view: 'monitor' as View,
      setView: (value: View) => set({ view: value }),
      editorState: { editor: initialEditorState, history: initialHistoryState },
      dispatch: (action: EditorAction) => {
        set((state) => {
          const newState = editorReducer(state.editorState, action)
          return { editorState: newState }
        })
      },
    }),
    {
      name: 'builder-storage',
    },
  ),
)
