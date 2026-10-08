import {
  Sidebar,
  SidebarContent,
} from '@spsedu360/shared-ui/src/components/atoms/sidebar'
import { Tabs } from '@spsedu360/shared-ui/src/components/atoms/tabs'
import { TooltipProvider } from '@spsedu360/shared-ui/src/components/atoms/tooltip'
import React, { useEffect, useState } from 'react'
import SideBarTabList from './tabs/tab-list'
import SettingsTab from './tabs/settings-tab'
import ComponentStyling from './tabs/component-styling'
import ComponentList from './tabs/components-list'
import NewComponent from './tabs/new-component'
import PageData from './tabs/page-data'

type SideBarProps = {
  props?: React.ComponentProps<typeof Sidebar>
}

const BuilderSideBar = ({ props }: SideBarProps) => {
  const [activeTab, setActiveTab] = useState('component-styling')

  const renderTabAsPerValue = () => {
    switch (activeTab) {
      case 'component':
        return <NewComponent />
      case 'components-list':
        return <ComponentList />
      case 'page-data':
        return <PageData />
      case 'component-styling':
        return <ComponentStyling />
      default:
        return <SettingsTab />
    }
  }

  useEffect(() => {
    setActiveTab('component-styling')
  }, [])

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="pr-2 border-none transition-all"
      side="right"
      {...props}
    >
      <SidebarContent>
        <TooltipProvider>
          <Tabs
            defaultValue={activeTab}
            onValueChange={setActiveTab}
            className="w-[250px] px-1 py-3 overflow-hidden h-[90vh]"
          >
            {/* Tabs Content */}
            <SideBarTabList />
            {renderTabAsPerValue()}
          </Tabs>
        </TooltipProvider>
      </SidebarContent>
    </Sidebar>
  )
}

export default BuilderSideBar
