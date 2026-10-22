import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { assertDocumentType } from '../search/search-query';
import {
  BuildPdfDto,
  CreateDocumentDto,
  MergeDocumentsDto,
  ReorderPagesDto,
  ShareDocumentDto,
  UpdateDocumentDto,
} from './dto';
import { DocumentsService } from './documents.service';

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('documents')
  list(
    @CurrentUser() user: AuthUser,
    @Query('folder') folder?: string,
    @Query('favorite') favorite?: string,
    @Query('archived') archived?: string,
    @Query('type') type?: string,
    @Query('deleted') deleted?: string,
  ) {
    return this.documents.list(user.id, {
      folderId: folder || undefined,
      favorite: parseBool(favorite),
      archived: parseBool(archived),
      type: type ? assertDocumentType(type) : undefined,
      deleted: deleted === '1' || deleted === 'true',
    });
  }

  @Post('documents')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user.id, dto);
  }

  @Post('documents/merge')
  merge(@CurrentUser() user: AuthUser, @Body() dto: MergeDocumentsDto) {
    return this.documents.merge(user.id, dto);
  }

  @Get('documents/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(user.id, id);
  }

  @Put('documents/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(user.id, id, dto);
  }

  @Delete('documents/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.documents.softDelete(user.id, id, request);
  }

  @Post('documents/:id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.restore(user.id, id);
  }

  @Post('documents/:id/duplicate')
  duplicate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.duplicate(user.id, id);
  }

  @Post('documents/:id/pages/reorder')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderPagesDto,
  ) {
    return this.documents.reorderPages(user.id, id, dto.pageIds);
  }

  @Post('documents/:id/share')
  share(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareDocumentDto,
  ) {
    return this.documents.share(user.id, id, dto);
  }

  @Post('documents/:id/pdf')
  pdf(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BuildPdfDto) {
    return this.documents.buildPdf(user.id, id, dto);
  }

  @Post('documents/:id/split')
  split(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.split(user.id, id);
  }

  @Public()
  @Get('shares/:token')
  shareMetadata(@Param('token') token: string) {
    return this.documents.shareMetadata(token);
  }
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return undefined;
}
