import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms'
import { COMMA, ENTER } from '@angular/cdk/keycodes'
import { debounceTime, map } from 'rxjs'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatAutocompleteModule } from '@angular/material/autocomplete'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatRadioModule } from '@angular/material/radio'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatSliderModule } from '@angular/material/slider'
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatTimepickerModule } from '@angular/material/timepicker'
import { MatButtonToggleModule } from '@angular/material/button-toggle'
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { provideNativeDateAdapter } from '@angular/material/core'
import {
  Block,
  Scope,
  blockClasses,
  fieldName,
  interpolate,
  lines,
  lookup,
  stringify,
} from '../../core/model'
import { FormScope } from '../../core/runtime/form-scope'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { BlockSkeleton } from './block-skeleton'

interface Choice {
  label: string
  value: string
}

const MULTI_VALUE = new Set(['chip-input', 'file'])

/** Every form input block, backed by a reactive FormControl registered with the enclosing form. */
@Component({
  selector: 'wb-field-block',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    BlockSkeleton,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  templateUrl: './field-block.html',
})
export class FieldBlock implements OnInit {
  readonly block = input.required<Block>()
  readonly scope = input.required<Scope>()
  /** Value computed by a binding; when set the field shows it read-only. */
  readonly computedValue = input<{ value: unknown } | undefined>(undefined, {
    alias: 'computed',
  })
  /** Options computed by a binding (dependent dropdowns); null uses the block's own items. */
  readonly optionsOverride = input<Choice[] | null>(null, { alias: 'choices' })

  readonly runtime = inject(SiteRuntime)
  private readonly form = inject(FormScope, { optional: true })
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)

  readonly control = new FormControl<unknown>(null)
  readonly range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  })
  /** Bumps whenever the control's value, status or touched state changes, so OnPush views refresh. */
  private readonly state = toSignal(
    this.control.events.pipe(map((_, index) => index)),
    { initialValue: 0 },
  )
  readonly filter = signal('')
  readonly separators = [ENTER, COMMA] as const

  readonly classes = computed(() => blockClasses(this.block()) + ' wb-field')
  readonly label = computed(() =>
    interpolate(this.block().props['label'], this.scope()),
  )
  readonly name = computed(() => fieldName(this.block()))
  readonly appearance = computed(() =>
    this.block().props['appearance'] === 'fill' ? 'fill' : 'outline',
  )
  readonly optionsLoading = computed(
    () =>
      !this.optionsOverride() &&
      !!this.block().props['source'] &&
      this.runtime.isLoading(String(this.block().props['source'])),
  )
  readonly isComputed = computed(() => this.computedValue() !== undefined)
  readonly choices = computed<Choice[]>(() => {
    const override = this.optionsOverride()
    if (override) return override
    const props = this.block().props
    const source = String(props['source'] ?? '')
    if (source) {
      const labelField = String(props['labelField'] || 'name')
      const valueField = String(props['valueField'] || labelField)
      return this.runtime.rowsFor(source).map((row) => ({
        label: stringify(lookup(row, labelField)),
        value: stringify(lookup(row, valueField)),
      }))
    }
    return lines(interpolate(props['items'], this.scope())).map(
      ([label, value]) => ({ label, value: value ?? label }),
    )
  })
  readonly suggestions = computed(() => {
    const term = this.filter().toLowerCase()
    return this.choices()
      .filter((choice) => choice.label.toLowerCase().includes(term))
      .slice(0, 50)
  })

  readonly invalid = computed(() => {
    this.state()
    return this.control.invalid && this.control.touched
  })
  readonly error = computed(() => {
    this.state()
    const errors = this.control.errors ?? {}
    const label = this.label() || 'This field'
    if (errors['required']) return `${label} is required.`
    if (errors['email']) return 'Enter a valid email address.'
    if (errors['minlength'])
      return `Use at least ${errors['minlength'].requiredLength} characters.`
    if (errors['maxlength'])
      return `Use at most ${errors['maxlength'].requiredLength} characters.`
    if (errors['pattern'])
      return 'The value does not match the expected format.'
    if (errors['min'] || errors['max']) return 'The value is out of range.'
    return ''
  })
  readonly listValue = computed<string[]>(() => {
    this.state()
    return Array.isArray(this.control.value)
      ? this.control.value.map(String)
      : []
  })

  constructor() {
    const destroyRef = inject(DestroyRef)

    // Keep validators and the disabled state in sync with the block's properties. Keyed on the
    // relevant props so computed props elsewhere on the block don't reset anything.
    const rulesKey = computed(() => {
      const props = this.block().props
      return JSON.stringify([
        this.block().type,
        props['required'],
        props['inputType'],
        props['minLength'],
        props['maxLength'],
        props['pattern'],
        props['disabled'],
      ])
    })
    effect(() => {
      rulesKey()
      const props = untracked(() => this.block().props)
      const validators: ValidatorFn[] = []
      if (props['required'])
        validators.push(
          this.block().type === 'checkbox' || this.block().type === 'switch'
            ? Validators.requiredTrue
            : MULTI_VALUE.has(this.block().type)
              ? (c: AbstractControl) =>
                  Array.isArray(c.value) && c.value.length
                    ? null
                    : { required: true }
              : Validators.required,
        )
      if (props['inputType'] === 'email') validators.push(Validators.email)
      if (Number(props['minLength']) > 0)
        validators.push(Validators.minLength(Number(props['minLength'])))
      if (Number(props['maxLength']) > 0)
        validators.push(Validators.maxLength(Number(props['maxLength'])))
      if (props['pattern']) {
        try {
          new RegExp(String(props['pattern']))
          validators.push(Validators.pattern(String(props['pattern'])))
        } catch {
          /* ignore invalid pattern */
        }
      }
      untracked(() => {
        this.control.setValidators(validators)
        if (props['disabled']) this.control.disable({ emitEvent: false })
        else this.control.enable({ emitEvent: false })
        this.control.updateValueAndValidity({ emitEvent: false })
      })
    })

    // Initial value; re-applied only when the default itself changes (e.g. edited in the studio).
    const initialKey = computed(() => JSON.stringify(this.initial()))
    effect(() => {
      initialKey()
      untracked(() => {
        if (this.computedValue()) return
        const bound = this.boundValue()
        this.control.setValue(bound ?? this.initial(), { emitEvent: false })
        this.publish()
      })
    })

    // Computed values follow their expression continuously.
    effect(() => {
      const computedValue = this.computedValue()
      if (!computedValue) return
      untracked(() => {
        const value = this.coerceAny(computedValue.value)
        if (stringify(value) !== stringify(this.control.value))
          this.control.setValue(value, { emitEvent: false })
        this.publish()
      })
    })

    // Writes from page rules and "Set field value" actions.
    let lastWrite = 0
    effect(() => {
      const write = this.runtime.fieldWrites()[this.name()]
      if (!write || write.seq === lastWrite) return
      lastWrite = write.seq
      untracked(() => {
        this.control.setValue(this.coerceAny(write.value))
        this.control.markAsDirty()
      })
    })

    // Re-publish under a new name if the field is renamed.
    effect(() => {
      this.name()
      untracked(() => this.publish())
    })

    // Two-way variable binding.
    effect(() => {
      const variable = String(this.block().props['bind'] ?? '')
      if (!variable) return
      const value = this.coerce(this.runtime.value(variable))
      untracked(() => {
        if (stringify(value) !== stringify(this.control.value))
          this.control.setValue(value, { emitEvent: false })
      })
    })

    // Live value for other fields' logic (immediate), actions and bindings (debounced).
    const live = this.control.valueChanges.subscribe(() => this.publish())
    const changes = this.control.valueChanges
      .pipe(debounceTime(250))
      .subscribe((value) => {
        const block = this.block()
        if (block.props['bind'])
          this.runtime.setValue(String(block.props['bind']), value)
        void this.runtime.run(block.actions, 'change', {
          scope: { ...this.scope(), value },
          form: this.form,
        })
      })
    destroyRef.onDestroy(() => {
      live.unsubscribe()
      changes.unsubscribe()
      this.form?.unregister(this.registeredId)
    })
  }

  private registeredId = ''

  ngOnInit(): void {
    if (!this.form) return
    this.registeredId = this.block().id
    this.form.register({
      blockId: this.registeredId,
      name: () => this.name(),
      control: this.control,
      focus: () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(
            'input, textarea, select, [tabindex="0"], .mat-mdc-select',
          )
          ?.focus(),
      reset: () => {
        this.control.reset(this.initial())
        this.range.reset()
        this.filter.set('')
      },
    })
  }

  /** Publishes the current value into the page scope as `fields.<name>`. */
  private publish(): void {
    const value = this.control.value
    this.runtime.publishField(
      this.name(),
      value instanceof Date ? value.toISOString().slice(0, 10) : value,
    )
  }

  /** Converts any computed or written value to what this control type expects. */
  private coerceAny(value: unknown): unknown {
    // Missing inputs (e.g. qty × price before anything is typed) show as empty, not "NaN".
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      return this.initial()
    if (typeof value === 'string') return this.coerce(value)
    const type = this.block().type
    if (
      (type === 'chip-input' ||
        type === 'file' ||
        ((type === 'select' || type === 'toggle-group') &&
          this.block().props['multiple'])) &&
      !Array.isArray(value)
    )
      return [value]
    if (type === 'checkbox' || type === 'switch') return !!value
    if (type === 'slider') return Number(value) || 0
    return Array.isArray(value) || typeof value === 'object'
      ? value
      : String(value)
  }

  private initial(): unknown {
    const block = this.block()
    switch (block.type) {
      case 'checkbox':
      case 'switch':
        return false
      case 'slider':
        return Number(block.props['value']) || 0
      case 'select':
      case 'toggle-group':
        return block.props['multiple'] ? [] : null
      case 'chip-input':
      case 'file':
        return []
      case 'datepicker':
      case 'calendar':
        return null
      default:
        return ''
    }
  }

  private boundValue(): unknown {
    const variable = String(this.block().props['bind'] ?? '')
    return variable ? this.coerce(this.runtime.value(variable)) : undefined
  }

  private coerce(value: string): unknown {
    const block = this.block()
    switch (block.type) {
      case 'checkbox':
      case 'switch':
        return value === 'true'
      case 'slider':
        return Number(value) || 0
      case 'chip-input':
        return value
          ? value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : []
      case 'select':
      case 'toggle-group':
        return block.props['multiple']
          ? value
            ? value.split(',').map((item) => item.trim())
            : []
          : value || null
      case 'datepicker':
      case 'calendar':
        return value ? new Date(value) : null
      default:
        return value
    }
  }

  t(key: string): string {
    return interpolate(this.block().props[key], this.scope())
  }
  bool(key: string): boolean {
    return this.block().props[key] === true
  }
  num(key: string, fallback = 0): number {
    const value = Number(this.block().props[key])
    return Number.isFinite(value) ? value : fallback
  }

  addChip(event: MatChipInputEvent): void {
    const value = event.value.trim()
    if (value && !this.listValue().includes(value))
      this.control.setValue([...this.listValue(), value])
    event.chipInput.clear()
    this.control.markAsTouched()
  }

  removeChip(value: string): void {
    this.control.setValue(this.listValue().filter((item) => item !== value))
  }

  pickFiles(event: Event): void {
    const input = event.target as HTMLInputElement
    this.control.setValue(
      Array.from(input.files ?? []).map((file) => file.name),
    )
    this.control.markAsTouched()
  }

  rangeChanged(): void {
    const { start, end } = this.range.value
    this.control.setValue(
      start
        ? `${start.toISOString().slice(0, 10)} – ${end ? end.toISOString().slice(0, 10) : ''}`
        : null,
    )
  }

  calendarChanged(date: Date | null): void {
    this.control.setValue(date)
    this.control.markAsTouched()
  }
}
