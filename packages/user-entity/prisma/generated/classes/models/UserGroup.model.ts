import { IsString, IsDefined, IsInt } from 'class-validator'
import { User, Group } from './'

export class UserGroup {
  @IsDefined()
  @IsString()
  userId!: string

  @IsDefined()
  @IsInt()
  groupId!: number

  @IsDefined()
  user!: User

  @IsDefined()
  group!: Group
}
