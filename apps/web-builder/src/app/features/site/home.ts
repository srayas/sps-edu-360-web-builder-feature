import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { ShellService } from '@spsedu360/shared-ui'
import { BLOCK_DEFINITIONS, TEMPLATES } from '../../core/model'

@Component({
  selector: 'wb-home',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wb-hero-mesh ui-py-8 ui-px-5">
      <div
        class="ui-column ui-align-start ui-gap-5 ui-max-lg ui-mx-auto ui-enter"
      >
        <span class="wb-logic-chip">spsEdu360 · Web Builder</span>
        <h1 class="wb-hero-title">
          Design, connect and ship web apps visually
        </h1>
        <p
          class="mat-font-body-lg mat-text-on-surface-variant ui-m-0 ui-max-sm"
        >
          Drag Material components onto pages, bind them to live data, make
          fields react to each other and publish — all styled by one Angular
          Material theme.
        </p>
        <div class="ui-row ui-wrap ui-gap-3">
          <a matButton="filled" routerLink="/projects"
            ><mat-icon>arrow_forward</mat-icon>Open the builder</a
          >
          <a matButton="outlined" href="#capabilities">What you can build</a>
        </div>
      </div>
    </section>
    <section id="capabilities" class="ui-py-7 ui-px-5">
      <div class="wb-bento ui-max-lg ui-mx-auto">
        @for (feature of features; track feature.title) {
          <article class="wb-bento-card ui-enter">
            <span class="wb-bento-icon"
              ><mat-icon>{{ feature.icon }}</mat-icon></span
            >
            <h2 class="mat-font-title-lg ui-m-0">{{ feature.title }}</h2>
            <p class="mat-font-body-md ui-m-0">{{ feature.text }}</p>
          </article>
        }
      </div>
    </section>
  `,
})
export class Home {
  readonly features = [
    {
      icon: 'account_tree',
      title: 'Reactive logic, no code',
      text: 'Show, hide, enable, require and compute any block from other fields. Page rules drive many blocks from one condition, evaluated by a compiled JSON Logic engine.',
    },
    {
      icon: 'widgets',
      title: `${BLOCK_DEFINITIONS.filter((item) => !item.internal).length} building blocks`,
      text: 'Layouts, content, navigation, every Material form control, tables, charts and dialogs.',
    },
    {
      icon: 'api',
      title: 'Live data',
      text: 'REST APIs, collections and JSON shaped with point-and-click filters, sort and search — never raw queries.',
    },
    {
      icon: 'auto_awesome',
      title: `${TEMPLATES.length} templates`,
      text: 'Hero, pricing, dashboards, sign-in and a working task tracker.',
    },
    {
      icon: 'palette',
      title: 'One theme',
      text: 'Material 3 by default; override per block and screen size.',
    },
    {
      icon: 'cloud_sync',
      title: 'Resilient actions',
      text: 'Queued requests with retries, idempotency keys and an offline outbox.',
    },
    {
      icon: 'rocket_launch',
      title: 'Publish',
      text: 'Preview with live interactions, publish, or export HTML and JSON.',
    },
  ]

  constructor() {
    inject(ShellService).breadcrumbs.set([{ label: 'Home' }])
  }
}
