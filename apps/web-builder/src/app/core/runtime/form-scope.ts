import { Injectable, signal } from '@angular/core'
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
  /** True while the form's submit actions run (submit buttons show progress). */
  readonly busy = signal(false)

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

  /**
   * Shows field errors returned by a server (e.g. "email is already taken") on the matching
   * fields and focuses the first one. Returns how many fields were matched. The errors clear as
   * soon as the user edits the field.
   */
  setServerErrors(errors: Record<string, string>): number {
    const normalized = new Map(
      Object.entries(errors).map(([key, message]) => [
        key.toLowerCase(),
        message,
      ]),
    )
    let first: FieldRegistration | undefined
    let matched = 0
    for (const field of this.fields.values()) {
      const name = field.name().toLowerCase()
      const message =
        normalized.get(name) ??
        [...normalized].find(([key]) => key.split('.').pop() === name)?.[1]
      if (!message) continue
      matched++
      field.control.setErrors({
        ...(field.control.errors ?? {}),
        server: message,
      })
      field.control.markAsTouched()
      first ??= field
    }
    first?.focus?.()
    return matched
  }

  reset(): void {
    for (const field of this.fields.values()) field.reset()
  }
}
