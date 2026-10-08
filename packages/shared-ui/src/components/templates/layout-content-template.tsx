import React, { useEffect, useState } from 'react'
import { SidebarInset, useSidebar } from '../atoms/sidebar'
import NavBar from '../molecules/nav-bar/nav-bar'
import { Toaster } from 'sonner'
import { usePathname } from 'next/navigation'
import { useAppMenuStore } from '../../store/useAppMenuStore'

type LayoutContentTemplateProps = {
  children: React.ReactNode
}

const LayoutContentTemplate = ({ children }: LayoutContentTemplateProps) => {
  const { open, isMobile } = useSidebar()
  const [showNav, setShowNav] = useState<boolean>(true)
  const pathname = usePathname()
  const { showSideBar } = useAppMenuStore()

  useEffect(() => {
    if (/^\/builder\/[^/]+$/.test(pathname)) {
      setShowNav(false)
    } else {
      setShowNav(true)
    }
  }, [pathname])

  return (
    <SidebarInset
      className={`mr-2.5 mb-2.5 rounded-xl my-2 max-h-[100vh] overflow-hidden ${showSideBar && !isMobile ? (open ? 'ml-[240px]' : 'ml-[50px]') : 'ml-2.5'}`}
    >
      {showNav && <NavBar />}

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-y-auto max-h-[100vh]">
        {children}
        <Toaster />
      </div>
    </SidebarInset>
  )
}

export default LayoutContentTemplate
