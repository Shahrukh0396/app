import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createWorker, Worker } from 'tesseract.js';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { refreshSearchVector } from '../search/search-vector';
import { UploadedImage } from '../pages/pages.service';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly workers = new Map<string, Promise<Worker>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  async extract(userId: string, file: UploadedImage | undefined, lang = 'eng', pageId?: string) {
    if (!file || file.size === 0) throw new BadRequestException('Image file is required');
    const worker = await this.worker(lang);
    const result = await worker.recognize(file.buffer);
    const text = result.data.text.trim();
    if (pageId) {
      const page = await this.prisma.page.findUnique({ where: { id: pageId }, include: { document: true } });
      if (!page || page.document.userId !== userId) {
        throw new BadRequestException('Page not found for this user');
      }
      await this.prisma.page.update({ where: { id: pageId }, data: { ocrText: text, version: { increment: 1 } } });
      await this.documents.recount(page.documentId);
      await refreshSearchVector(this.prisma, page.documentId);
    }
    return {
      text,
      lang,
      confidence: result.data.confidence,
      blocks: result.data.blocks?.map((block) => ({
        text: block.text,
        bbox: block.bbox,
        confidence: block.confidence,
      })) ?? [],
    };
  }

  private worker(lang: string): Promise<Worker> {
    const existing = this.workers.get(lang);
    if (existing) return existing;
    const created = createWorker(lang).catch((error: unknown) => {
      this.workers.delete(lang);
      this.logger.error(`Failed to start tesseract worker for ${lang}`);
      throw error;
    });
    this.workers.set(lang, created);
    return created;
  }
}
