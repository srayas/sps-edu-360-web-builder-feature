import { IsString, IsDefined, IsInt } from 'class-validator'
import { User, App } from './'

export class UserApp {
  @IsDefined()
  @IsString()
  userId!: string

  @IsDefined()
  @IsInt()
  appId!: number

  @IsDefined()
  user!: User

  @IsDefined()
  app!: App
}
