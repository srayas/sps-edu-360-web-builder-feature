import {
  IsString,
  IsDefined,
  IsOptional,
  IsInt,
  IsDate,
  IsBoolean,
} from 'class-validator'
import { UserApp, UserGroup, UserRole } from './'

export class User {
  @IsDefined()
  @IsString()
  uid!: string

  @IsOptional()
  @IsString()
  userName?: string

  @IsOptional()
  @IsString()
  emailId?: string

  @IsDefined()
  @IsString()
  firstName!: string

  @IsDefined()
  @IsString()
  lastName!: string

  @IsOptional()
  @IsInt()
  mobileNumber?: number

  @IsDefined()
  @IsString()
  clerkId!: string

  @IsDefined()
  @IsDate()
  createdAt!: Date

  @IsDefined()
  @IsDate()
  updatedAt!: Date

  @IsDefined()
  @IsBoolean()
  isLoggedInOnce!: boolean

  @IsDefined()
  apps!: UserApp[]

  @IsDefined()
  groups!: UserGroup[]

  @IsDefined()
  UserRole!: UserRole[]
}
