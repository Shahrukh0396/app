import { DocumentType, PageSizeName, SharePermission } from '@scanflow/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDocumentDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ReorderPagesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  pageIds!: string[];
}

export class ShareDocumentDto {
  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class BuildPdfDto {
  @IsOptional()
  @IsEnum(PageSizeName)
  pageSize?: PageSizeName;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  watermark?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  password?: string;

  @IsOptional()
  @IsBoolean()
  compress?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(95)
  jpegQuality?: number;
}

export class MergeDocumentsDto extends BuildPdfDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  documentIds!: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
}
