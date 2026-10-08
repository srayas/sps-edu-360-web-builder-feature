import { IsInt, IsDefined, IsString } from 'class-validator'
import { AppRoles, UserApp, UserRole } from './'

export class App {
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
  roles!: AppRoles[]

  @IsDefined()
  users!: UserApp[]

  @IsDefined()
  UserRole!: UserRole[]
}
