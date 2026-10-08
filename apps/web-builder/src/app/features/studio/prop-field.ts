import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatAutocompleteModule } from '@angular/material/autocomplete'
import { MatIconModule } from '@angular/material/icon'
import { Block, PropDef, PropValue, fieldKey, safeUrl } from '../../core/model'
import { BuilderStore } from './builder-store'
import { ICONS } from './icons'

/** Editor for one block property, chosen by the property's kind in the registry. */
@Component({
  selector: 'wb-prop-field',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = prop();
    @let v = value();
    @switch (p.kind) {
      @case ('toggle') {
        <mat-slide-toggle
          [checked]="v === true"
          (change)="set($event.checked)"
          >{{ p.label }}</mat-slide-toggle
        >
      }
      @case ('select') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <mat-select [value]="v" (selectionChange)="set($event.value)">
            @for (option of p.options; track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @case ('source') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <mat-select [value]="v" (selectionChange)="set($event.value)">
            <mat-option value="">None</mat-option>
            @for (source of store.project().dataSources; track source.id) {
              <mat-option [value]="source.id"
                >{{ source.name }} · {{ source.kind }}</mat-option
              >
            }
          </mat-select>
          @if (p.hint) {
            <mat-hint>{{ p.hint }}</mat-hint>
          }
        </mat-form-field>
      }
      @case ('variable') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <mat-select [value]="v" (selectionChange)="set($event.value)">
            <mat-option value="">None</mat-option>
            @for (variable of store.project().variables; track variable.id) {
              <mat-option [value]="variable.id">{{ variable.name }}</mat-option>
            }
          </mat-select>
          @if (p.hint) {
            <mat-hint>{{ p.hint }}</mat-hint>
          }
        </mat-form-field>
      }
      @case ('page') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <mat-select [value]="v" (selectionChange)="set($event.value)">
            @for (page of store.project().pages; track page.id) {
              <mat-option [value]="page.id">{{ page.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @case ('icon') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          @if (v) {
            <mat-icon matPrefix>{{ v }}</mat-icon>
          }
          <input
            matInput
            [value]="v"
            [matAutocomplete]="icons"
            (input)="
              iconFilter.set($any($event.target).value);
              set($any($event.target).value)
            "
            placeholder="e.g. star"
          />
          <mat-autocomplete
            #icons="matAutocomplete"
            (optionSelected)="set($event.option.value)"
          >
            <mat-option value="">No icon</mat-option>
            @for (icon of iconOptions(); track icon) {
              <mat-option [value]="icon"
                ><mat-icon>{{ icon }}</mat-icon
                >{{ icon }}</mat-option
              >
            }
          </mat-autocomplete>
        </mat-form-field>
      }
      @case ('textarea') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <textarea
            matInput
            rows="3"
            [value]="v"
            (input)="set($any($event.target).value)"
          ></textarea>
          @if (p.hint) {
            <mat-hint>{{ p.hint }}</mat-hint>
          }
        </mat-form-field>
      }
      @case ('items') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <textarea
            matInput
            rows="5"
            class="wb-mono"
            [value]="v"
            (input)="set($any($event.target).value)"
          ></textarea>
          @if (p.hint) {
            <mat-hint>{{ p.hint }}</mat-hint>
          }
        </mat-form-field>
      }
      @case ('number') {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <input
            matInput
            type="number"
            [min]="p.min ?? null"
            [max]="p.max ?? null"
            [value]="v"
            (input)="setNumber($any($event.target).value)"
          />
        </mat-form-field>
      }
      @default {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ui-fill"
        >
          <mat-label>{{ p.label }}</mat-label>
          <input
            matInput
            [type]="p.kind === 'url' || p.kind === 'media' ? 'url' : 'text'"
            [value]="v"
            [placeholder]="placeholder()"
            (input)="set($any($event.target).value)"
          />
          @if (urlWarning()) {
            <mat-hint class="mat-text-error">{{ urlWarning() }}</mat-hint>
          } @else if (p.hint) {
            <mat-hint>{{ p.hint }}</mat-hint>
          }
        </mat-form-field>
      }
    }
  `,
})
export class PropField {
  readonly prop = input.required<PropDef>()
  readonly block = input.required<Block>()
  readonly store = inject(BuilderStore)
  readonly iconFilter = signal('')

  readonly value = computed<PropValue>(
    () => this.block().props[this.prop().key] ?? this.prop().default,
  )
  readonly iconOptions = computed(() => {
    const term = this.iconFilter().trim().toLowerCase()
    return [...new Set(ICONS)]
      .filter((icon) => icon.includes(term))
      .slice(0, 60)
  })
  readonly placeholder = computed(() =>
    this.prop().kind === 'field'
      ? fieldKey(String(this.block().props['label'] || this.block().name))
      : '',
  )
  readonly urlWarning = computed(() => {
    const kind = this.prop().kind
    const value = String(this.value() ?? '').trim()
    if ((kind !== 'url' && kind !== 'media') || !value || value.includes('{{'))
      return ''
    return safeUrl(value, kind === 'media')
      ? ''
      : kind === 'media'
        ? 'Use an https:// address or a /path on this site.'
        : 'Use https://, a /path, #anchor, mailto: or tel:.'
  })

  set(value: PropValue): void {
    this.store.updateProps({ [this.prop().key]: value }, this.prop().key)
  }

  setNumber(value: string): void {
    const number = Number(value)
    if (!Number.isFinite(number)) return
    const { min, max } = this.prop()
    this.set(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, number)))
  }
}
