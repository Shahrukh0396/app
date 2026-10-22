import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class ExtractOcrDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z]{3}(\+[a-zA-Z]{3})*$/)
  @MaxLength(32)
  lang?: string;

  @IsOptional()
  @IsUUID()
  pageId?: string;
}
