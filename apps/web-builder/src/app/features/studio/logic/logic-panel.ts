import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { FunctionsPanel } from './functions-panel'
import { RulesPanel } from './rules-panel'
import { WorkflowsPanel } from './workflows-panel'

/** Left-panel Logic tab: page rules, reusable functions and workflows. */
@Component({
  selector: 'wb-logic-panel',
  imports: [MatButtonToggleModule, RulesPanel, FunctionsPanel, WorkflowsPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-column">
      <div class="ui-px-3 ui-pt-3">
        <mat-button-toggle-group
          [value]="view()"
          (change)="view.set($event.value)"
          hideSingleSelectionIndicator
          aria-label="Logic section"
          class="ui-fill"
        >
          <mat-button-toggle value="rules">Rules</mat-button-toggle>
          <mat-button-toggle value="functions">Functions</mat-button-toggle>
          <mat-button-toggle value="workflows">Workflows</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      @switch (view()) {
        @case ('rules') {
          <wb-rules-panel />
        }
        @case ('functions') {
          <div class="ui-p-3"><wb-functions-panel /></div>
        }
        @case ('workflows') {
          <div class="ui-p-3"><wb-workflows-panel /></div>
        }
      }
    </div>
  `,
})
export class LogicPanel {
  readonly view = signal<'rules' | 'functions' | 'workflows'>('rules')
}
