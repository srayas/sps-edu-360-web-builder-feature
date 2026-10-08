import { IsInt, IsDefined, IsString } from 'class-validator'
import { App, RoleActions, UserRole } from './'

export class AppRoles {
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
  appId!: number

  @IsDefined()
  app!: App

  @IsDefined()
  actions!: RoleActions[]

  @IsDefined()
  UserRole!: UserRole[]
}
