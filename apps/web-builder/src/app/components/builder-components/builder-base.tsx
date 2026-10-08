import { SidebarInset } from '@spsedu360/shared-ui/src/components/atoms/sidebar'
import React, { useEffect } from 'react'
import BuilderNav from './builder-nav'
import { useBuilderStore } from '@/store/useBuilderStore'
import { EyeOff } from 'lucide-react'

interface BuilderBaseProps {
  children: React.ReactNode
}

const BuilderBase = ({ children }: BuilderBaseProps) => {
  const { view, setView, editorState, dispatch } = useBuilderStore()

  useEffect(() => {}, [view])

  return (
    <>
      {view != 'preview' && (
        <SidebarInset
          className={`mb-2.5 ml-2.5 rounded-xl my-2 h-[90vh] overflow-hidden bg-sidebar mr-[260px] }`}
        >
          <BuilderNav />
          <div
            className={`h-[100vh] flex justify-center items-center w-full rounded-xl`}
          >
            <div
              className={`h-full  overflow-y-auto flex bg-background justify-center rounded-xl ${view == 'smartphone' ? 'w-[420px] ' : ''} ${view == 'monitor' ? 'w-full' : ''} ${view == 'tablet' ? 'w-[850px]' : ''}`}
            >
              {children}
            </div>
          </div>
        </SidebarInset>
      )}
      {view == 'preview' && (
        <div
          className={`h-full flex bg-background justify-center p-0 m-0 w-full overflow-y-auto`}
        >
          {!editorState.editor.liveMode && (
            <EyeOff
              height={15}
              width={15}
              className="absolute top-2 right-2 opacity-50 hover:opacity-100 cursor-pointer transition-opacity duration-200 z-9999"
              onClick={() => {
                setView('monitor')
                dispatch({
                  type: 'TOGGLE_PREVIEW_MODE',
                  payload: { value: false },
                })
              }}
            />
          )}
          {children}
        </div>
      )}
    </>
  )
}

export default BuilderBase
