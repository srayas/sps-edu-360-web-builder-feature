'use client'
export const dynamic = 'force-dynamic'
import React, { useEffect } from 'react'
import { SideBarMenuItem } from '@spsedu360/shared-ui/src/types/side-bar'
import { CalendarSync, Gauge, Settings, SquarePen, Table } from 'lucide-react'
import { useAppMenuStore } from '@spsedu360/shared-ui/src/store/useAppMenuStore'

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const menuItems: SideBarMenuItem[] = [
    {
      icon: Gauge,
      label: 'Dashboard',
      route: '#',
      children: [
        {
          label: 'eCommerce',
          route: '/',

          active: false,
          name: 'eCommerce',
        },
      ],
      active: false,
      name: 'dashboard',
    },
    {
      icon: CalendarSync,
      label: 'Calendar',
      route: '/calendar',
      active: false,
      name: 'calendar',
    },
    {
      icon: SquarePen,
      label: 'Forms',
      route: '#',
      children: [
        {
          label: 'Form Elements',
          route: '/forms/form-elements',

          active: false,
          name: 'formElements',
        },
        {
          label: 'Form Layout',
          route: '/forms/form-layout',

          active: false,
          name: 'formLayout',
        },
      ],
      active: false,
      name: 'forms',
    },
    {
      icon: Table,
      label: 'Tables',
      route: '/tables',
      active: false,
      name: 'tables',
    },
    {
      icon: Settings,
      label: 'Settings',
      route: '/settings',
      active: false,
      name: 'settings',
    },
  ]
  const { setMenuItems, setShowSideBar } = useAppMenuStore()

  useEffect(() => {
      setMenuItems(menuItems)
      setShowSideBar(true)
  }, [setMenuItems, setShowSideBar])

  return <>{children}</>
}
