'use client'

import React, { useEffect } from 'react'
import { SidebarProvider } from '../atoms/sidebar'
import ThemeProvider from '../../provider/theme-provider'
import LayoutContentTemplate from '../templates/layout-content-template'
import AppSideBar from '../molecules/side-bar/app-side-bar'
import { usePathname } from 'next/navigation'
import { useAppMenuStore } from '../../store/useAppMenuStore'

type BaseLayoutProps = {
  children: React.ReactNode
}

const BaseLayout = ({ children }: BaseLayoutProps) => {
  const pathname = usePathname()
  const { showSideBar, setShowSideBar } = useAppMenuStore()

  useEffect(() => {
    if (pathname == '/sign-in' || /^\/builder\/[^/]+$/.test(pathname)) {
      setShowSideBar(false)
    } else {
      setShowSideBar(true)
    }
  }, [pathname])

  useEffect(() => {
    console.log(showSideBar)
  }, [showSideBar])

  return (
    <ThemeProvider
      attribute={'class'}
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <SidebarProvider defaultOpen={false}>
        {showSideBar && <AppSideBar />}
        <LayoutContentTemplate>{children}</LayoutContentTemplate>
      </SidebarProvider>
    </ThemeProvider>
  )
}

export default BaseLayout
