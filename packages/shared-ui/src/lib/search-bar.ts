import { ChangeDetectionStrategy, Component, input, model } from '@angular/core'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'

@Component({
  selector: 'ui-search-bar',
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field
      appearance="outline"
      subscriptSizing="dynamic"
      class="ui-fill"
    >
      <mat-icon matPrefix>search</mat-icon>
      <input
        matInput
        type="search"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
      />
      @if (value()) {
        <button
          matSuffix
          mat-icon-button
          aria-label="Clear search"
          (click)="value.set('')"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
    </mat-form-field>
  `,
})
export class SearchBar {
  readonly placeholder = input('Search')
  readonly value = model('')
}
