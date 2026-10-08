import { Injectable, signal } from '@angular/core'

/** A side navigation entry. `route` is a router link; items with children render as a group. */
export interface NavItem {
  label: string
  icon?: string
  route?: string
  exact?: boolean
  children?: NavItem[]
}

export interface Breadcrumb {
  label: string
  route?: string
}

export interface Team {
  name: string
  plan: string
  icon: string
}

/** Shell state shared between routed pages and the application frame (replaces the React menu store). */
@Injectable({ providedIn: 'root' })
export class ShellService {
  readonly title = signal('spsEdu360')
  readonly menu = signal<NavItem[]>([])
  readonly breadcrumbs = signal<Breadcrumb[]>([])
  readonly showNavigation = signal(true)
  readonly search = signal('')

  configure(options: {
    menu?: NavItem[]
    breadcrumbs?: Breadcrumb[]
    showNavigation?: boolean
  }): void {
    if (options.menu) this.menu.set(options.menu)
    if (options.breadcrumbs) this.breadcrumbs.set(options.breadcrumbs)
    if (options.showNavigation !== undefined)
      this.showNavigation.set(options.showNavigation)
  }
}
