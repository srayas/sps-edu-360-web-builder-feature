import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core'
import {
  Block,
  Scope,
  blockClasses,
  blockLayoutClasses,
  interpolate,
} from '../../core/model'
import { FormScope } from '../../core/runtime/form-scope'
import { SiteRuntime } from '../../core/runtime/site-runtime'
import { BlockList } from './block-list'

/** A form block: provides a FormScope for the fields below it and runs its submit actions. */
@Component({
  selector: 'wb-form-block',
  imports: [forwardRef(() => BlockList)],
  providers: [FormScope],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'wb-contents' },
  template: `
    <form
      ngNoForm
      novalidate
      [class]="classes()"
      [attr.aria-busy]="busy()"
      (submit)="submit($event)"
      (reset)="reset($event)"
    >
      <wb-block-list
        [blocks]="block().children"
        [parentId]="block().id"
        parentType="form"
        [layoutClass]="layout()"
        [scope]="scope()"
        [depth]="depth() + 1"
        [disabled]="disabled()"
      />
    </form>
  `,
})
export class FormBlock {
  readonly block = input.required<Block>()
  readonly scope = input.required<Scope>()
  readonly depth = input(0)
  readonly disabled = input(false)

  private readonly runtime = inject(SiteRuntime)
  private readonly form = inject(FormScope)
  readonly busy = this.form.busy
  readonly classes = computed(() => blockClasses(this.block()))
  readonly layout = computed(() => blockLayoutClasses(this.block()))

  async submit(event: Event): Promise<void> {
    event.preventDefault()
    if (this.runtime.mode() === 'edit' || this.busy() || this.disabled()) return
    if (!this.form.validate()) {
      this.runtime.notify({
        severity: 'warning',
        message: 'Please complete the highlighted fields.',
      })
      return
    }
    this.busy.set(true)
    try {
      const block = this.block()
      const ok = await this.runtime.run(block.actions, 'submit', {
        scope: this.scope(),
        form: this.form,
      })
      if (!ok) return
      const success = interpolate(block.props['successMessage'], {
        ...this.scope(),
        form: this.form.values(),
      })
      if (
        success &&
        !block.actions.some(
          (action) =>
            action.trigger === 'submit' && action.type === 'showMessage',
        )
      )
        this.runtime.notify({ severity: 'success', message: success })
      if (block.props['resetOnSubmit']) this.form.reset()
    } finally {
      this.busy.set(false)
    }
  }

  reset(event: Event): void {
    event.preventDefault()
    this.form.reset()
  }
}
