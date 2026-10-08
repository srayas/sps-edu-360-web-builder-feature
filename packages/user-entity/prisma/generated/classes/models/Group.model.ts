import { IsInt, IsDefined, IsString } from 'class-validator'
import { UserGroup } from './'

export class Group {
  @IsDefined()
  @IsInt()
  id!: number

  @IsDefined()
  @IsString()
  name!: string

  @IsDefined()
  @IsString()
  description!: string

  @IsDefined()
  users!: UserGroup[]
}
