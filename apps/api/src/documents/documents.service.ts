import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType as PrismaDocumentType, TeamRole } from '@prisma/client';
import { DocumentRecord, DocumentType, PageSizeName, SharePermission } from '@scanflow/types';
import { randomToken } from '../auth/auth.tokens';
import { AuditService } from '../audit/audit.service';
import { Request } from 'express';
import { APP_ENV, AppEnv } from '../config/env';
import { Inject } from '@nestjs/common';
import { FoldersService } from '../folders/folders.service';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { refreshSearchVector } from '../search/search-vector';
import { R2Service } from '../storage/r2.service';
import { toDocument } from './document.mapper';
import { BuildPdfDto, CreateDocumentDto, MergeDocumentsDto, ShareDocumentDto, UpdateDocumentDto } from './dto';

const WRITE_ROLES: TeamRole[] = ['OWNER', 'ADMIN', 'EDITOR'];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folders: FoldersService,
    private readonly audit: AuditService,
    private readonly pdf: PdfService,
    private readonly r2: R2Service,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async list(
    userId: string,
    filters: {
      folderId?: string;
      favorite?: boolean;
      archived?: boolean;
      type?: DocumentType;
      deleted?: boolean;
    },
  ): Promise<DocumentRecord[]> {
    const teamIds = await this.teamIds(userId);
    const rows = await this.prisma.document.findMany({
      where: {
        OR: [{ userId }, { teamId: { in: teamIds } }],
        deletedAt: filters.deleted ? { not: null } : null,
        folderId: filters.folderId,
        favorite: filters.favorite,
        archived: filters.archived,
        documentType: filters.type as PrismaDocumentType | undefined,
      },
      include: { tags: true },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => toDocument(row));
  }

  async assertWritable(userId: string, id: string): Promise<void> {
    await this.requireAccess(userId, id, true);
  }

  async get(userId: string, id: string): Promise<DocumentRecord> {
    const row = await this.requireAccess(userId, id, false);
    return toDocument(row, true);
  }

  async create(userId: string, dto: CreateDocumentDto): Promise<DocumentRecord> {
    if (dto.folderId) await this.folders.requireOwned(userId, dto.folderId);
    if (dto.teamId) await this.requireTeamRole(userId, dto.teamId, WRITE_ROLES);
    const tags = normalizeTags(dto.tags);
    const row = await this.prisma.document.create({
      data: {
        id: dto.id,
        userId,
        folderId: dto.folderId ?? null,
        teamId: dto.teamId ?? null,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        documentType: (dto.documentType ?? DocumentType.DOCUMENT) as PrismaDocumentType,
        favorite: dto.favorite ?? false,
        tags: { create: tags.map((tag) => ({ tag })) },
      },
      include: { tags: true, pages: true },
    });
    await refreshSearchVector(this.prisma, row.id);
    return toDocument(row, true);
  }

  async update(userId: string, id: string, dto: UpdateDocumentDto): Promise<DocumentRecord> {
    const current = await this.requireAccess(userId, id, true);
    if (dto.version !== undefined && dto.version !== current.version) {
      throw new ConflictVersion(current.version);
    }
    if (dto.folderId) await this.folders.requireOwned(userId, dto.folderId);
    const tags = dto.tags ? normalizeTags(dto.tags) : undefined;
    const row = await this.prisma.$transaction(async (tx) => {
      if (tags) {
        await tx.documentTag.deleteMany({ where: { documentId: id } });
        if (tags.length > 0) {
          await tx.documentTag.createMany({ data: tags.map((tag) => ({ documentId: id, tag })) });
        }
      }
      return tx.document.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description?.trim(),
          folderId: dto.folderId,
          documentType: dto.documentType as PrismaDocumentType | undefined,
          favorite: dto.favorite,
          archived: dto.archived,
          version: { increment: 1 },
        },
        include: { tags: true, pages: true },
      });
    });
    await refreshSearchVector(this.prisma, id);
    return toDocument(row, true);
  }

  async softDelete(userId: string, id: string, request: Request): Promise<{ ok: true }> {
    await this.requireAccess(userId, id, true);
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    await this.audit.write({
      userId,
      action: 'document.delete',
      entity: 'Document',
      entityId: id,
      ip: request.ip,
      userAgent: request.header('user-agent'),
    });
    return { ok: true };
  }

  async restore(userId: string, id: string): Promise<DocumentRecord> {
    const row = await this.prisma.document.findUnique({ where: { id }, include: { tags: true, pages: true } });
    if (!row || row.userId !== userId) throw new NotFoundException('Document not found');
    if (!row.deletedAt) return toDocument(row, true);
    const updated = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: null, version: { increment: 1 } },
      include: { tags: true, pages: true },
    });
    await refreshSearchVector(this.prisma, id);
    return toDocument(updated, true);
  }

  async duplicate(userId: string, id: string): Promise<DocumentRecord> {
    const source = await this.requireAccess(userId, id, false);
    const copy = await this.prisma.document.create({
      data: {
        userId,
        folderId: source.folderId,
        teamId: source.teamId,
        title: `${source.title} copy`,
        description: source.description,
        thumbnail: source.thumbnail,
        previewImage: source.previewImage,
        ocrText: source.ocrText,
        pageCount: source.pages.length,
        size: source.size,
        documentType: source.documentType,
        favorite: false,
        archived: false,
        tags: { create: source.tags.map((tag) => ({ tag: tag.tag })) },
      },
    });
    for (const page of source.pages) {
      let storageKey = page.storageKey;
      let imageUrl = page.imageUrl;
      if (page.storageKey && this.r2.configured()) {
        const bytes = await this.r2.get(page.storageKey);
        storageKey = this.r2.keyFor(userId, 'documents', copy.id, 'pages', page.id);
        await this.r2.put(storageKey, bytes, page.mime ?? 'image/jpeg');
        imageUrl = await this.r2.presignGet(storageKey);
      }
      await this.prisma.page.create({
        data: {
          documentId: copy.id,
          imageUrl,
          storageKey,
          mime: page.mime,
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          ocrText: page.ocrText,
          rotation: page.rotation,
          filter: page.filter,
          size: page.size,
        },
      });
    }
    await refreshSearchVector(this.prisma, copy.id);
    const full = await this.prisma.document.findUniqueOrThrow({
      where: { id: copy.id },
      include: { tags: true, pages: true },
    });
    return toDocument(full, true);
  }

  async reorderPages(userId: string, id: string, pageIds: string[]): Promise<DocumentRecord> {
    const doc = await this.requireAccess(userId, id, true);
    const existing = new Set(doc.pages.map((page) => page.id));
    if (pageIds.length !== doc.pages.length || pageIds.some((pageId) => !existing.has(pageId))) {
      throw new BadRequestException('pageIds must list every page of the document exactly once');
    }
    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < pageIds.length; index += 1) {
        await tx.page.update({ where: { id: pageIds[index] }, data: { pageNumber: -(index + 1) } });
      }
      for (let index = 0; index < pageIds.length; index += 1) {
        const pageId = pageIds[index];
        if (!pageId) continue;
        await tx.page.update({
          where: { id: pageId },
          data: { pageNumber: index + 1, version: { increment: 1 } },
        });
      }
      await tx.document.update({ where: { id }, data: { version: { increment: 1 } } });
    });
    return this.get(userId, id);
  }

  async share(userId: string, id: string, dto: ShareDocumentDto) {
    await this.requireAccess(userId, id, false);
    const token = randomToken(24);
    const row = await this.prisma.documentShare.create({
      data: {
        documentId: id,
        createdById: userId,
        token,
        permission: dto.permission ?? SharePermission.VIEW,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return {
      id: row.id,
      documentId: row.documentId,
      token: row.token,
      url: `${this.env.publicApiUrl}/shares/${row.token}`,
      permission: row.permission,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async shareMetadata(token: string) {
    const share = await this.prisma.documentShare.findUnique({
      where: { token },
      include: { document: { include: { tags: true } } },
    });
    if (!share || share.revokedAt) throw new NotFoundException('Share link not found');
    if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Share link has expired');
    }
    return {
      documentId: share.documentId,
      title: share.document.title,
      pageCount: share.document.pageCount,
      documentType: share.document.documentType,
      permission: share.permission,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      tags: share.document.tags.map((tag) => tag.tag),
    };
  }

  async buildPdf(userId: string, id: string, dto: BuildPdfDto): Promise<{ pdfUrl: string; storageKey: string | null; bytes: number }> {
    const doc = await this.requireAccess(userId, id, true);
    const bytes = await this.renderDocument(doc, dto);
    return this.storePdf(userId, doc.id, bytes);
  }

  async merge(userId: string, dto: MergeDocumentsDto) {
    const buffers: Buffer[] = [];
    for (const id of dto.documentIds) {
      const doc = await this.requireAccess(userId, id, false);
      buffers.push(await this.renderDocument(doc, dto));
    }
    const merged = await this.pdf.merge(buffers);
    const created = await this.create(userId, { title: dto.title, documentType: DocumentType.DOCUMENT });
    const stored = await this.storePdf(userId, created.id, merged);
    return { documentId: created.id, ...stored };
  }

  async split(userId: string, id: string) {
    const doc = await this.requireAccess(userId, id, false);
    const pdf = await this.renderDocument(doc, {});
    const parts = await this.pdf.split(pdf);
    return { pages: parts.length, byteSizes: parts.map((part) => part.length) };
  }

  async recount(documentId: string): Promise<void> {
    const pages = await this.prisma.page.findMany({ where: { documentId } });
    const size = pages.reduce((sum, page) => sum + page.size, 0);
    const ocrText = pages
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((page) => page.ocrText)
      .filter((text) => text.trim().length > 0)
      .join('\n');
    const first = pages.slice().sort((a, b) => a.pageNumber - b.pageNumber)[0];
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        pageCount: pages.length,
        size,
        ocrText,
        thumbnail: first?.imageUrl ?? null,
        previewImage: first?.imageUrl ?? null,
        version: { increment: 1 },
      },
    });
    await refreshSearchVector(this.prisma, documentId);
  }

  private async renderDocument(
    doc: { pages: Array<{ storageKey: string | null; mime: string | null; ocrText: string; pageNumber: number }> },
    dto: BuildPdfDto,
  ): Promise<Buffer> {
    const ordered = doc.pages.slice().sort((a, b) => a.pageNumber - b.pageNumber);
    if (ordered.length === 0) throw new BadRequestException('Document has no pages');
    const images: Array<{ image: Buffer; mime: string; ocrText: string }> = [];
    for (const page of ordered) {
      if (!page.storageKey) throw new BadRequestException('A page is missing stored image bytes');
      const image = await this.r2.get(page.storageKey);
      images.push({ image, mime: page.mime ?? 'image/jpeg', ocrText: page.ocrText });
    }
    return this.pdf.build(images, {
      pageSize: dto.pageSize as PageSizeName | undefined,
      watermark: dto.watermark,
      password: dto.password,
      compress: dto.compress,
      jpegQuality: dto.jpegQuality,
    });
  }

  private async storePdf(userId: string, documentId: string, bytes: Buffer) {
    let storageKey: string | null = null;
    let pdfUrl = `data:application/pdf;base64,${bytes.toString('base64')}`;
    if (this.r2.configured()) {
      storageKey = this.r2.keyFor(userId, 'documents', documentId, 'export.pdf');
      await this.r2.put(storageKey, bytes, 'application/pdf');
      pdfUrl = await this.r2.presignGet(storageKey);
    }
    await this.prisma.document.update({
      where: { id: documentId },
      data: { pdfUrl, pdfStorageKey: storageKey, version: { increment: 1 } },
    });
    return { pdfUrl, storageKey, bytes: bytes.length };
  }

  private async teamIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } });
    return rows.map((row) => row.teamId);
  }

  private async requireTeamRole(userId: string, teamId: string, roles: TeamRole[]) {
    const member = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException('You cannot edit documents in this team');
    }
  }

  private async requireAccess(userId: string, id: string, write: boolean) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { tags: true, pages: { orderBy: { pageNumber: 'asc' } } },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Document not found');
    if (doc.userId === userId) return doc;
    if (doc.teamId) {
      const member = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: doc.teamId, userId } },
      });
      if (member && (!write || WRITE_ROLES.includes(member.role))) return doc;
    }
    throw new ForbiddenException('You cannot access this document');
  }
}

export class ConflictVersion extends BadRequestException {
  constructor(serverVersion: number) {
    super({ message: 'Document version conflict', serverVersion });
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  const unique = new Set<string>();
  for (const tag of tags ?? []) {
    const clean = tag.trim().toLowerCase();
    if (clean) unique.add(clean.slice(0, 40));
  }
  return [...unique];
}
