import { TeamRole } from '@scanflow/types';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class InviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(TeamRole)
  role!: TeamRole;
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
