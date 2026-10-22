import { SyncEntity } from '@scanflow/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class SyncChangeDto {
  @IsEnum(SyncEntity)
  entity!: SyncEntity;

  @IsIn(['upsert', 'delete'])
  op!: 'upsert' | 'delete';

  @IsUUID()
  id!: string;

  @IsInt()
  @Min(0)
  version!: number;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncPushDto {
  @IsString()
  deviceId!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncChangeDto)
  changes!: SyncChangeDto[];
}

export class SyncPullDto {
  @IsOptional()
  @IsString()
  since?: string;
}

export class RestoreDto {
  @IsUUID()
  backupId!: string;
}
