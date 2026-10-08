import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core'
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router'
import { MatIconRegistry } from '@angular/material/icon'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { ThemeService } from '@spsedu360/shared-ui'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (navigating()) {
      <mat-progress-bar
        class="ui-route-progress"
        mode="indeterminate"
        aria-label="Loading page"
      />
    }
    @if (booting()) {
      <!-- Same skeleton as index.html, kept until the first page has loaded. -->
      <div class="ui-boot" aria-busy="true" aria-label="Loading">
        <div class="ui-boot-side">
          <span class="ui-sk ui-sk-title"></span
          ><span class="ui-sk ui-sk-line"></span
          ><span class="ui-sk ui-sk-line"></span>
        </div>
        <div class="ui-boot-main">
          <span class="ui-sk ui-boot-hero"></span>
          <div class="ui-boot-cards">
            <span class="ui-sk ui-boot-card"></span
            ><span class="ui-sk ui-boot-card"></span
            ><span class="ui-sk ui-boot-card"></span>
          </div>
        </div>
      </div>
    }
    <router-outlet />
  `,
})
export class App {
  // Instantiated once so the stored light/dark preference is applied on start-up.
  protected readonly theme = inject(ThemeService)
  /** True only while a navigation takes longer than 120 ms (fast ones never flash a bar). */
  protected readonly navigating = signal(false)
  /** True until the first navigation settles, so a cold start never shows a blank page. */
  protected readonly booting = signal(true)

  constructor() {
    // Material Symbols include every icon name offered by the studio.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined')

    let timer: ReturnType<typeof setTimeout> | undefined
    const subscription = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        clearTimeout(timer)
        if (!this.booting())
          timer = setTimeout(() => this.navigating.set(true), 120)
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        clearTimeout(timer)
        this.navigating.set(false)
        this.booting.set(false)
      }
    })
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe())
  }
}
