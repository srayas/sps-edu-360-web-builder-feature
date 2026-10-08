'use client'

import React from 'react'
import { SidebarProvider } from '@spsedu360/shared-ui/src/components/atoms/sidebar'
import BuilderSideBar from '../builder-components/side-bar/builder-side-bar'
import BuilderBase from '../builder-components/builder-base'
import { useBuilderStore } from '@/store/useBuilderStore'
import { Toaster } from '@spsedu360/shared-ui/src/components/atoms/toaster'
import { Toaster as SonnerToaster } from '@spsedu360/shared-ui/src/components/atoms/sonner'

interface ClientBuilderLayoutProps {
  children: React.ReactNode
}

const ClientBuilderLayout = ({ children }: ClientBuilderLayoutProps) => {
  const { view } = useBuilderStore()

  return (
    <>
      {view && view != 'preview' ? (
        <>
          <SidebarProvider defaultOpen={true} className="bg-sidebar test-123">
            <BuilderBase>{children}</BuilderBase>
            <BuilderSideBar />
            <Toaster />
            <SonnerToaster position="bottom-left" />
          </SidebarProvider>
        </>
      ) : (
        <>
          <BuilderBase>{children}</BuilderBase>
          <Toaster />
          <SonnerToaster position="bottom-left" />
        </>
      )}
    </>
  )
}

export default ClientBuilderLayout
