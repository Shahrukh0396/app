import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PageFilter } from '@prisma/client';
import { PageFilterName } from '@scanflow/types';
import { DocumentsService } from '../documents/documents.service';
import { toPage } from '../documents/document.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { CreatePageDto, MovePageDto } from './dto';

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly r2: R2Service,
  ) {}

  async create(userId: string, file: UploadedImage | undefined, dto: CreatePageDto) {
    if (!file || file.size === 0) throw new BadRequestException('Image file is required');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only image uploads are accepted');
    await this.documents.assertWritable(userId, dto.documentId);
    const count = await this.prisma.page.count({ where: { documentId: dto.documentId } });
    const page = await this.prisma.page.create({
      data: {
        documentId: dto.documentId,
        imageUrl: 'pending',
        pageNumber: count + 1,
        width: dto.width ?? 0,
        height: dto.height ?? 0,
        rotation: dto.rotation ?? 0,
        filter: (dto.filter ?? PageFilterName.ORIGINAL) as PageFilter,
        mime: file.mimetype,
        size: file.size,
      },
    });
    const key = this.r2.keyFor(userId, 'documents', dto.documentId, 'pages', `${page.id}.bin`);
    await this.r2.put(key, file.buffer, file.mimetype);
    const imageUrl = await this.r2.presignGet(key);
    const saved = await this.prisma.page.update({
      where: { id: page.id },
      data: { storageKey: key, imageUrl },
    });
    await this.documents.recount(dto.documentId);
    return toPage(saved);
  }

  async remove(userId: string, id: string) {
    const page = await this.requirePage(userId, id);
    if (page.storageKey && this.r2.configured()) {
      await this.r2.delete(page.storageKey);
    }
    await this.prisma.page.delete({ where: { id } });
    await this.renumber(page.documentId);
    await this.documents.recount(page.documentId);
    return { ok: true as const };
  }

  async move(userId: string, id: string, dto: MovePageDto) {
    const page = await this.requirePage(userId, id);
    await this.documents.assertWritable(userId, dto.documentId);
    const targetCount = await this.prisma.page.count({ where: { documentId: dto.documentId } });
    const pageNumber = dto.pageNumber ?? targetCount + (dto.documentId === page.documentId ? 0 : 1);
    await this.prisma.page.update({
      where: { id },
      data: { documentId: dto.documentId, pageNumber: pageNumber + 10000, version: { increment: 1 } },
    });
    await this.renumber(page.documentId);
    await this.renumber(dto.documentId);
    await this.documents.recount(page.documentId);
    if (dto.documentId !== page.documentId) await this.documents.recount(dto.documentId);
    const moved = await this.prisma.page.findUniqueOrThrow({ where: { id } });
    return toPage(moved);
  }

  async copy(userId: string, id: string, dto: MovePageDto) {
    const page = await this.requirePage(userId, id);
    await this.documents.assertWritable(userId, dto.documentId);
    let storageKey = page.storageKey;
    let imageUrl = page.imageUrl;
    const created = await this.prisma.page.create({
      data: {
        documentId: dto.documentId,
        imageUrl: 'pending',
        pageNumber: 10000 + (await this.prisma.page.count({ where: { documentId: dto.documentId } })),
        width: page.width,
        height: page.height,
        ocrText: page.ocrText,
        rotation: page.rotation,
        filter: page.filter,
        mime: page.mime,
        size: page.size,
      },
    });
    if (page.storageKey) {
      const bytes = await this.r2.get(page.storageKey);
      storageKey = this.r2.keyFor(userId, 'documents', dto.documentId, 'pages', `${created.id}.bin`);
      await this.r2.put(storageKey, bytes, page.mime ?? 'image/jpeg');
      imageUrl = await this.r2.presignGet(storageKey);
    }
    const saved = await this.prisma.page.update({
      where: { id: created.id },
      data: { storageKey, imageUrl },
    });
    await this.renumber(dto.documentId);
    await this.documents.recount(dto.documentId);
    return toPage(saved);
  }

  private async requirePage(userId: string, id: string) {
    const page = await this.prisma.page.findUnique({ where: { id }, include: { document: true } });
    if (!page || page.document.deletedAt) throw new NotFoundException('Page not found');
    await this.documents.assertWritable(userId, page.documentId);
    return page;
  }

  private async renumber(documentId: string) {
    const pages = await this.prisma.page.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' },
    });
    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        if (!page) continue;
        await tx.page.update({ where: { id: page.id }, data: { pageNumber: -(index + 1) } });
      }
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        if (!page) continue;
        await tx.page.update({ where: { id: page.id }, data: { pageNumber: index + 1 } });
      }
    });
  }
}
