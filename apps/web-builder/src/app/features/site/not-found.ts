import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MatButtonModule } from '@angular/material/button'
import { EmptyState } from '@spsedu360/shared-ui'

@Component({
  selector: 'wb-not-found',
  imports: [RouterLink, MatButtonModule, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-empty-state
      icon="explore_off"
      heading="Page not found"
      message="The page you are looking for does not exist or has moved."
    >
      <a matButton="filled" routerLink="/">Go home</a>
    </ui-empty-state>
  `,
})
export class NotFound {}
