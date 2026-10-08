import { Injectable } from '@angular/core'
import type { AbstractControl } from '@angular/forms'

export interface FieldRegistration {
  blockId: string
  name: () => string
  control: AbstractControl
  /** Element to focus when the field is the first invalid one. */
  focus?: () => void
  reset: () => void
}

/**
 * Collects the fields rendered inside one Form block. Provided by the form component so every
 * field below it (at any depth) registers with the nearest form through dependency injection.
 */
@Injectable()
export class FormScope {
  private readonly fields = new Map<string, FieldRegistration>()

  register(field: FieldRegistration): void {
    this.fields.set(field.blockId, field)
  }
  unregister(blockId: string): void {
    this.fields.delete(blockId)
  }

  values(): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const field of this.fields.values())
      values[field.name()] = field.control.value
    return values
  }

  /** Marks every field touched and reports validity, focusing the first invalid field. */
  validate(): boolean {
    let firstInvalid: FieldRegistration | undefined
    for (const field of this.fields.values()) {
      field.control.markAllAsTouched()
      field.control.updateValueAndValidity()
      if (field.control.invalid && !firstInvalid) firstInvalid = field
    }
    firstInvalid?.focus?.()
    return !firstInvalid
  }

  reset(): void {
    for (const field of this.fields.values()) field.reset()
  }
}
