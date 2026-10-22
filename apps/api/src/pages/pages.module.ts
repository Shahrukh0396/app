import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [DocumentsModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
