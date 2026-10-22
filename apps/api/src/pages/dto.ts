import { PageFilterName } from '@scanflow/types';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreatePageDto {
  @IsUUID()
  documentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(359)
  rotation?: number;

  @IsOptional()
  @IsEnum(PageFilterName)
  filter?: PageFilterName;
}

export class MovePageDto {
  @IsUUID()
  documentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNumber?: number;
}
