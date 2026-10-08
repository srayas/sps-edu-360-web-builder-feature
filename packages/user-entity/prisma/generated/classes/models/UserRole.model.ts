import { IsString, IsDefined, IsInt } from 'class-validator'
import { User, AppRoles, App } from './'

export class UserRole {
  @IsDefined()
  @IsString()
  userId!: string

  @IsDefined()
  @IsInt()
  roleId!: number

  @IsDefined()
  @IsInt()
  appId!: number

  @IsDefined()
  user!: User

  @IsDefined()
  role!: AppRoles

  @IsDefined()
  app!: App
}
