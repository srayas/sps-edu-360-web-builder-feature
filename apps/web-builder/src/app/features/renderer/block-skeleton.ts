import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core'
import { Skeleton, SkeletonShape } from '@spsedu360/shared-ui'

const SHAPES: Record<string, SkeletonShape> = {
  table: 'table',
  chart: 'chart',
  'data-list': 'list',
  stat: 'stat',
  image: 'image',
  card: 'card',
  avatar: 'avatar',
  heading: 'title',
  text: 'paragraph',
  button: 'button',
  section: 'section',
  grid: 'section',
  repeater: 'card',
  input: 'field',
  textarea: 'field',
  select: 'field',
  autocomplete: 'field',
  datepicker: 'field',
  timepicker: 'field',
  'chip-input': 'field',
}

/** Skeleton shaped like the block it stands in for. */
@Component({
  selector: 'wb-block-skeleton',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ui-skeleton
    [shape]="shape()"
    [count]="count()"
    [cols]="cols()"
    [label]="'Loading ' + label()"
  />`,
})
export class BlockSkeleton {
  readonly type = input.required<string>()
  readonly label = input('content')
  readonly count = input(4)
  readonly cols = input(4)
  readonly shape = computed<SkeletonShape>(
    () => SHAPES[this.type()] ?? 'paragraph',
  )
}
