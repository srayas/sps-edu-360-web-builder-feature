import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SideBarMenuItem } from '../types/side-bar'

interface AppMenuState {
  menuItems: SideBarMenuItem[]
  setMenuItems: (menuItems: SideBarMenuItem[]) => void
  showSideBar: boolean
  setShowSideBar: (show: boolean) => void
}

export const useAppMenuStore = create<AppMenuState>()(
  persist(
    (set) => ({
      menuItems: [],
      setMenuItems: (menuItems: SideBarMenuItem[]) => set({ menuItems }),
      showSideBar: false,
      setShowSideBar: (show: boolean) => set({ showSideBar: show }),
    }),
    {
      name: 'menu-list-storage',
    },
  ),
)
