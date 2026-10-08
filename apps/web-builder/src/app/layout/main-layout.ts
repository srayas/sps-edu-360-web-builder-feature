import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AppShell, ShellService } from '@spsedu360/shared-ui'

/** Application frame for the non-editor pages (home, projects). */
@Component({
  selector: 'wb-main-layout',
  imports: [AppShell, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ui-app-shell brandIcon="dashboard_customize"
    ><router-outlet
  /></ui-app-shell>`,
})
export class MainLayout {
  constructor() {
    inject(ShellService).configure({
      showNavigation: true,
      menu: [
        { label: 'Home', icon: 'home', route: '/', exact: true },
        { label: 'Projects', icon: 'folder_open', route: '/projects' },
      ],
    })
    inject(ShellService).title.set('spsEdu360')
  }
}
