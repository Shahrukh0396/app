import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadedImage } from '../pages/pages.service';
import { ExtractOcrDto } from './dto';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @Post('extract')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  extract(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedImage | undefined,
    @Body() dto: ExtractOcrDto,
  ) {
    return this.ocr.extract(user.id, file, dto.lang ?? 'eng', dto.pageId);
  }
}
