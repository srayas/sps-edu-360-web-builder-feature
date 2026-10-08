import { TabsContent } from '@spsedu360/shared-ui/src/components/atoms/tabs'
import React from 'react'
import ComponentsTab from './components-tabs/components-tab'

const NewComponent = () => {
  return (
    <TabsContent value="component" className="h-full">
      <ComponentsTab />
    </TabsContent>
  )
}

export default NewComponent
