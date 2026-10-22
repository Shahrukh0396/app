import { Plan } from '@scanflow/types';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubscribeDto {
  @IsEnum(Plan)
  plan!: Plan;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  appUserId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  revenueCatId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  receipt?: string;
}
