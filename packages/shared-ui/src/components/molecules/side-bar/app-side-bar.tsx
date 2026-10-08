'use client'
import { redirect, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarImage, AvatarFallback } from '../../atoms/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../../atoms/sidebar'
import SideBarFooter from './side-bar-footer'
import { useAppMenuStore } from '../../../store/useAppMenuStore'
type SideBarProps = {
  props?: React.ComponentProps<typeof Sidebar>
}

const AppSideBar = ({ props }: SideBarProps) => {
  const { menuItems } = useAppMenuStore()
  const pathname = usePathname()
  if (!menuItems) return null
  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="pr-2 border-none"
      {...props}
    >
      <SidebarHeader className="pt-6 px-2 pb-0">
        {/* Ensure SidebarMenuButton does not wrap <button> */}
        <SidebarMenuButton
          size={'lg'}
          asChild
          className="data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex items-center gap-3">
            <div
              className="cursor-pointer flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground"
              onClick={() => {
                redirect('/')
              }}
            >
              <Avatar className="h-10 w-10 rounded-full">
                <AvatarImage src="./vercel.png" alt="logo" />
                <AvatarFallback className="rounded-lg">sps</AvatarFallback>
              </Avatar>
            </div>
            <span className="truncate text-primary text-2xl font-semibold">
              spsEdu360
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent className="px-2 mt-10 gay-y-6">
        <SidebarGroupContent className="p-0">
          <SidebarMenu>
            {menuItems && menuItems.length > 0
              ? menuItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    {/* Ensure SidebarMenuButton uses asChild for <Link> */}
                    <SidebarMenuButton
                      asChild
                      className={`${item.route && pathname.includes(item.route) ? 'bg-muted' : ''}`}
                    >
                      <Link
                        href={item.route || ''}
                        className={`text-lg ${item.route && pathname.includes(item.route) ? 'font-bold' : ''}`}
                      >
                        {item.icon && Object.keys(item.icon).length > 0 && (
                          <item.icon />
                        )}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              : null}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarContent>

      <SidebarFooter>
        <SideBarFooter />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSideBar
