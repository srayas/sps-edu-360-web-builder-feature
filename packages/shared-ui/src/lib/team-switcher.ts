import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatDividerModule } from '@angular/material/divider'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { Team } from './shell.service'

@Component({
  selector: 'ui-team-switcher',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active(); as team) {
      <button
        mat-button
        [matMenuTriggerFor]="menu"
        class="ui-fill"
        aria-label="Switch team"
      >
        <mat-icon>{{ team.icon }}</mat-icon>
        <span class="ui-column ui-align-start">
          <span class="mat-font-title-sm ui-truncate">{{ team.name }}</span>
          <span class="mat-font-label-sm mat-text-on-surface-variant">{{
            team.plan
          }}</span>
        </span>
        <mat-icon iconPositionEnd>unfold_more</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        @for (item of teams(); track item.name; let index = $index) {
          <button mat-menu-item (click)="selected.set(index)">
            <mat-icon>{{ item.icon }}</mat-icon
            ><span>{{ item.name }}</span>
          </button>
        }
        <mat-divider />
        <button mat-menu-item (click)="addTeam.emit()">
          <mat-icon>add</mat-icon><span>Add team</span>
        </button>
      </mat-menu>
    }
  `,
})
export class TeamSwitcher {
  readonly teams = input<Team[]>([])
  readonly selected = model(0)
  readonly addTeam = output<void>()
  readonly active = computed(
    () => this.teams()[this.selected()] ?? this.teams()[0],
  )
}
