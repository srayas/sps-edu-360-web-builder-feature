import { IsInt, IsDefined, IsString } from 'class-validator'
import { AppRoles } from './'

export class RoleActions {
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
  @IsInt()
  roleId!: number

  @IsDefined()
  roles!: AppRoles
}
