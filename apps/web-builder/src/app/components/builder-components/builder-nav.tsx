'use client'
import React, { FocusEventHandler } from 'react'
import {
  Smartphone,
  Tablet,
  Monitor,
  Eye,
  ArrowLeftCircle,
  Undo2,
  Redo2,
} from 'lucide-react'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@spsedu360/shared-ui/src/components/atoms/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@spsedu360/shared-ui/src/components/atoms/tooltip'
import { useBuilderStore } from '@/store/useBuilderStore'
import Link from 'next/link'
import { Input } from '@spsedu360/shared-ui/src/components/atoms/input'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@spsedu360/shared-ui/src/components/atoms/button'
import { View } from '@/types/editor-elements'

const BuilderNav = () => {
  const { view, setView, dispatch, editorState } = useBuilderStore()
  const router = useRouter()

  const handleOnBlurTitleChange: FocusEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    console.log('event', event)
    const title = event.target.value.trim()
    if (!title) {
      toast('Oops!', {
        description: 'You need to have a title!',
      })
      event.target.value = 'test'
      return
    }

    if (title !== 'test') {
      toast('Success', {
        description: 'Saved Funnel Page title',
      })
      router.refresh()
    }
  }

  const handlePreviewClick = () => {
    setView('preview')
    dispatch({ type: 'TOGGLE_PREVIEW_MODE' })
    // dispatch({ type: 'TOGGLE_LIVE_MODE' })
  }

  const handleUndo = () => {
    dispatch({ type: 'UNDO' })
  }

  const handleRedo = () => {
    dispatch({ type: 'REDO' })
  }

  // useEffect(() => {
  //   console.log(view)
  // }, [view])

  return (
    <TooltipProvider>
      <aside className="flex items-center justify-between w-full bg-sidebar px-4 py-2">
        {/* Left Section */}
        <div className="flex items-center gap-x-4">
          <Link href={`/`}>
            <ArrowLeftCircle />
          </Link>
          <div className="flex flex-col w-[200px]">
            <Input
              defaultValue="Test"
              className="border-none h-5 m-0 p-0 text-lg shadow-none rounded-none hover:!shadow-sm hover:!rounded-lg focus:!shadow-sm focus:!rounded-lg focus:!p-2"
              onBlur={handleOnBlurTitleChange}
            />
            <span className="text-sm text-muted-foreground">Path: /test</span>
          </div>
        </div>

        {/* Center Section - Toggle View */}
        <div className="flex items-center gap-x-2">
          <ToggleGroup type="single" className="bg-background rounded-lg flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="smartphone"
                  aria-label="Toggle smartphone"
                  className={`cursor-pointer ${view === 'smartphone' ? 'bg-muted' : ''}`}
                  onClick={() => {
                    setView('smartphone')
                    dispatch({
                      type: 'CHANGE_VIEW',
                      payload: { view: 'smartphone' as View },
                    })
                  }}
                >
                  <Smartphone className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mobile view</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="tablet"
                  aria-label="Toggle tablet"
                  className={`cursor-pointer ${view === 'tablet' ? 'bg-muted' : ''}`}
                  onClick={() => {
                    setView('tablet')
                    dispatch({
                      type: 'CHANGE_VIEW',
                      payload: { view: 'tablet' as View },
                    })
                  }}
                >
                  <Tablet className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tablet view</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="monitor"
                  aria-label="Toggle monitor"
                  className={`cursor-pointer ${view === 'monitor' ? 'bg-muted' : ''}`}
                  onClick={() => {
                    setView('monitor')
                    dispatch({
                      type: 'CHANGE_VIEW',
                      payload: { view: 'monitor' as View },
                    })
                  }}
                >
                  <Monitor className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>Desktop view</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="preview"
                  aria-label="Toggle maximize"
                  className={`cursor-pointer ${view === 'preview' ? 'bg-muted' : ''}`}
                  onClick={handlePreviewClick}
                >
                  <Eye className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>Preview</p>
              </TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </div>

        {/* Right Section - Undo/Redo */}
        <div className="flex items-center gap-x-2 cursor-pointer">
          <Button
            disabled={!(editorState.history.currentIndex > 0)}
            onClick={handleUndo}
            variant="ghost"
            size="icon"
            className="hover:bg-muted cursor-pointer"
          >
            <Undo2 />
          </Button>
          <Button
            disabled={
              !(
                editorState.history.currentIndex <
                editorState.history.history.length - 1
              )
            }
            onClick={handleRedo}
            variant="ghost"
            size="icon"
            className="hover:bg-muted cursor-pointer"
          >
            <Redo2 />
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}

export default BuilderNav
