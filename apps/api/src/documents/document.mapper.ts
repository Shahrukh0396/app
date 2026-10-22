import { Document, DocumentTag, Page } from '@prisma/client';
import { DocumentRecord, PageFilterName, PageRecord } from '@scanflow/types';

export type DocumentWithRelations = Document & {
  tags?: DocumentTag[];
  pages?: Page[];
};

export function toPage(row: Page): PageRecord {
  return {
    id: row.id,
    documentId: row.documentId,
    imageUrl: row.imageUrl,
    storageKey: row.storageKey,
    mime: row.mime,
    pageNumber: row.pageNumber,
    width: row.width,
    height: row.height,
    ocrText: row.ocrText,
    rotation: row.rotation,
    filter: row.filter as PageFilterName,
    size: row.size,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDocument(row: DocumentWithRelations, includePages = false): DocumentRecord {
  const record: DocumentRecord = {
    id: row.id,
    userId: row.userId,
    folderId: row.folderId,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    thumbnail: row.thumbnail,
    previewImage: row.previewImage,
    pdfUrl: row.pdfUrl,
    ocrText: row.ocrText,
    pageCount: row.pageCount,
    size: row.size,
    favorite: row.favorite,
    archived: row.archived,
    documentType: row.documentType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    version: row.version,
    tags: (row.tags ?? []).map((tag) => tag.tag),
  };
  if (includePages) {
    record.pages = (row.pages ?? []).map(toPage).sort((a, b) => a.pageNumber - b.pageNumber);
  }
  return record;
}
