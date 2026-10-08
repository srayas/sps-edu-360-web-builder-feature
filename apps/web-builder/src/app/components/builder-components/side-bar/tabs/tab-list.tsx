import {
  TabsList,
  TabsTrigger,
} from '@spsedu360/shared-ui/src/components/atoms/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@spsedu360/shared-ui/src/components/atoms/tooltip'
import {
  Brush,
  Database,
  PackagePlus,
  Settings,
  SquareStack,
} from 'lucide-react'
import React from 'react'

const SideBarTabList = () => {
  return (
    <TabsList className="gap-1 bg-background">
      {/* Add New Component with Tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger
            value="component"
            className="rounded-lg cursor-pointer text-xs text-accent-foreground aria-selected:bg-muted focus:bg-muted hover:bg-muted p-2"
          >
            <PackagePlus height={20} width={20} />
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add New Component</p>
        </TooltipContent>
      </Tooltip>

      {/* Setting Tabs */}
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger
            value="component-settings"
            className="rounded-lg cursor-pointer p-2 text-xs font-medium text-accent-foreground aria-selected:bg-muted focus:bg-muted hover:bg-muted"
          >
            <Settings height={20} width={20} />
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Edit the attributes of the components</p>
        </TooltipContent>
      </Tooltip>

      {/* Component List */}
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger
            value="components-list"
            className="rounded-lg cursor-pointer p-2 text-xs font-medium text-accent-foreground aria-selected:bg-muted focus:bg-muted hover:bg-muted"
          >
            <SquareStack height={20} width={20} />
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>View the components list</p>
        </TooltipContent>
      </Tooltip>

      {/* add or edit data source for the page */}
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger
            value="page-data"
            className="rounded-lg cursor-pointer p-2 text-xs font-medium text-accent-foreground aria-selected:bg-muted focus:bg-muted hover:bg-muted"
          >
            <Database height={20} width={20} />
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add or edit data source for the page</p>
        </TooltipContent>
      </Tooltip>

      {/* Component Styling */}
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger
            value="component-styling"
            className="rounded-lg cursor-pointer p-2 text-xs font-medium text-accent-foreground aria-selected:bg-muted focus:bg-muted hover:bg-muted"
          >
            <Brush height={20} width={20} />
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Edit the components styling</p>
        </TooltipContent>
      </Tooltip>
    </TabsList>
  )
}

export default SideBarTabList
