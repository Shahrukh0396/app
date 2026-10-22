import { getDatabase } from './database';

export interface LocalFolder {
  id: string;
  name: string;
  parentId: string | null;
  deletedAt: string | null;
}

export interface LocalDocument {
  id: string;
  folderId: string | null;
  title: string;
  description: string;
  documentType: string;
  favorite: boolean;
  archived: boolean;
  deletedAt: string | null;
  pageCount: number;
  size: number;
  ocrText: string;
  version: number;
  updatedAt: string;
}

function now(): string {
  return new Date().toISOString();
}

export const foldersRepo = {
  list(includeDeleted = false): LocalFolder[] {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT id, name, parent_id, deleted_at FROM folders WHERE ${includeDeleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'} ORDER BY name`,
    );
    return (result.rows ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      parentId: row.parent_id ? String(row.parent_id) : null,
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    }));
  },
  create(id: string, name: string, parentId: string | null) {
    getDatabase().executeSync('INSERT INTO folders (id, name, parent_id, updated_at) VALUES (?, ?, ?, ?)', [
      id,
      name,
      parentId,
      now(),
    ]);
  },
  rename(id: string, name: string) {
    getDatabase().executeSync('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [name, now(), id]);
  },
  move(id: string, parentId: string | null) {
    getDatabase().executeSync('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?', [parentId, now(), id]);
  },
  softDelete(id: string) {
    getDatabase().executeSync('UPDATE folders SET deleted_at = ?, updated_at = ? WHERE id = ?', [now(), now(), id]);
  },
};

export const documentsRepo = {
  list(filter: { favorite?: boolean; archived?: boolean; deleted?: boolean; folderId?: string } = {}): LocalDocument[] {
    const clauses = [filter.deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'];
    const params: Array<string | number> = [];
    if (filter.favorite) clauses.push('favorite = 1');
    if (filter.archived) clauses.push('archived = 1');
    if (filter.folderId) {
      clauses.push('folder_id = ?');
      params.push(filter.folderId);
    }
    const result = getDatabase().executeSync(
      `SELECT * FROM documents WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`,
      params,
    );
    return (result.rows ?? []).map(mapDocument);
  },
  recent(limit = 8): LocalDocument[] {
    const result = getDatabase().executeSync(
      'SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?',
      [limit],
    );
    return (result.rows ?? []).map(mapDocument);
  },
  smart(kind: 'favorites' | 'receipts' | 'archived'): LocalDocument[] {
    if (kind === 'favorites') return this.list({ favorite: true });
    if (kind === 'archived') return this.list({ archived: true });
    const result = getDatabase().executeSync(
      `SELECT * FROM documents WHERE deleted_at IS NULL AND document_type = 'RECEIPT' ORDER BY updated_at DESC`,
    );
    return (result.rows ?? []).map(mapDocument);
  },
  upsert(doc: LocalDocument) {
    getDatabase().executeSync(
      `INSERT INTO documents (id, folder_id, title, description, document_type, favorite, archived, deleted_at, page_count, size, ocr_text, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, folder_id = excluded.folder_id,
         favorite = excluded.favorite, archived = excluded.archived, deleted_at = excluded.deleted_at, page_count = excluded.page_count,
         size = excluded.size, ocr_text = excluded.ocr_text, version = excluded.version, updated_at = excluded.updated_at`,
      [
        doc.id,
        doc.folderId,
        doc.title,
        doc.description,
        doc.documentType,
        doc.favorite ? 1 : 0,
        doc.archived ? 1 : 0,
        doc.deletedAt,
        doc.pageCount,
        doc.size,
        doc.ocrText,
        doc.version,
        doc.updatedAt,
      ],
    );
  },
  duplicate(id: string, copyId: string) {
    const [source] = this.list({}).filter((doc) => doc.id === id);
    const deleted = this.list({ deleted: true }).find((doc) => doc.id === id);
    const doc = source ?? deleted;
    if (!doc) return;
    this.upsert({ ...doc, id: copyId, title: `${doc.title} copy`, favorite: false, updatedAt: now(), version: 1 });
  },
  stats() {
    const result = getDatabase().executeSync(
      'SELECT COUNT(*) AS docs, COALESCE(SUM(size), 0) AS bytes, COALESCE(SUM(page_count), 0) AS pages FROM documents WHERE deleted_at IS NULL',
    );
    const row = result.rows?.[0];
    return {
      documents: Number(row?.docs ?? 0),
      bytes: Number(row?.bytes ?? 0),
      pages: Number(row?.pages ?? 0),
    };
  },
};

export const tagsRepo = {
  set(documentId: string, tags: string[]) {
    const db = getDatabase();
    db.executeSync('DELETE FROM tags WHERE document_id = ?', [documentId]);
    for (const tag of tags) {
      db.executeSync('INSERT INTO tags (document_id, tag) VALUES (?, ?)', [documentId, tag.toLowerCase()]);
    }
  },
  forDocument(documentId: string): string[] {
    const result = getDatabase().executeSync('SELECT tag FROM tags WHERE document_id = ? ORDER BY tag', [documentId]);
    return (result.rows ?? []).map((row) => String(row.tag));
  },
};

function mapDocument(row: Record<string, unknown>): LocalDocument {
  return {
    id: String(row.id),
    folderId: row.folder_id ? String(row.folder_id) : null,
    title: String(row.title),
    description: String(row.description ?? ''),
    documentType: String(row.document_type ?? 'DOCUMENT'),
    favorite: Number(row.favorite) === 1,
    archived: Number(row.archived) === 1,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    pageCount: Number(row.page_count ?? 0),
    size: Number(row.size ?? 0),
    ocrText: String(row.ocr_text ?? ''),
    version: Number(row.version ?? 1),
    updatedAt: String(row.updated_at),
  };
}
