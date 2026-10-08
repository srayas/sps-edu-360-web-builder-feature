import { useBuilderStore } from '@/store/useBuilderStore'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@spsedu360/shared-ui/src/components/atoms/accordion'
import { Input } from '@spsedu360/shared-ui/src/components/atoms/input'
import { TabsContent } from '@spsedu360/shared-ui/src/components/atoms/tabs'
import React from 'react'

const SettingsTab = () => {
  const { editorState, dispatch } = useBuilderStore()

  const handleChangeCustomValues = (e: any) => {
    const stylingProperty = e.target.id
    const value = e.target.value
    const styleObject = {
      [stylingProperty]: value,
    }

    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...editorState.editor.selectedElement,
          content: {
            ...editorState.editor.selectedElement.content,
            ...styleObject,
          },
        },
      },
    })
  }
  return (
    <TabsContent className="overflow-y-auto" value="component-settings">
      <Accordion
        type="multiple"
        className="w-full overflow-y-auto"
        defaultValue={['Typography', 'Dimensions', 'Decorations', 'FlexBox']}
      >
        <AccordionItem value="Custom" className="px-6 py-0">
          <AccordionTrigger className="!no-underline">Custom</AccordionTrigger>
          <AccordionContent>
            {editorState.editor.selectedElement.type === 'link' &&
              !Array.isArray(editorState.editor.selectedElement.content) && (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground">Link Path</p>
                  <Input
                    id="href"
                    placeholder="https://domain.example.com/pathname"
                    onChange={handleChangeCustomValues}
                    value={editorState.editor.selectedElement.content.href}
                  />
                </div>
              )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </TabsContent>
  )
}

export default SettingsTab
