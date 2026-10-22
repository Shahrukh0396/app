import { DocumentType } from '@scanflow/types';

export interface SearchQueryInput {
  userId: string;
  teamIds: string[];
  q?: string;
  type?: DocumentType;
  tag?: string;
  from?: Date;
  to?: Date;
  limit: number;
}

export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

const DOCUMENT_TYPES = new Set<string>(Object.values(DocumentType));

export function assertDocumentType(value: string | undefined): DocumentType | undefined {
  if (!value) return undefined;
  if (!DOCUMENT_TYPES.has(value)) {
    throw new Error(`Unknown document type ${value}`);
  }
  return value as DocumentType;
}

export function buildDocumentSearch(input: SearchQueryInput): BuiltQuery {
  const params: unknown[] = [input.userId];
  const where: string[] = ['d."deletedAt" IS NULL'];
  if (input.teamIds.length === 0) {
    where.push('d."userId" = $1');
  } else {
    params.push(input.teamIds);
    where.push(`(d."userId" = $1 OR d."teamId" = ANY($${params.length}::text[]))`);
  }
  const query = input.q?.trim();
  let rankParam: number | null = null;
  if (query) {
    params.push(query);
    rankParam = params.length;
    where.push(`d."searchVector" @@ plainto_tsquery('simple', $${rankParam})`);
  }
  if (input.type) {
    params.push(input.type);
    where.push(`d."documentType" = $${params.length}::"DocumentType"`);
  }
  if (input.tag) {
    params.push(input.tag.toLowerCase());
    where.push(
      `EXISTS (SELECT 1 FROM "DocumentTag" t WHERE t."documentId" = d.id AND lower(t.tag) = $${params.length})`,
    );
  }
  if (input.from) {
    params.push(input.from);
    where.push(`d."createdAt" >= $${params.length}`);
  }
  if (input.to) {
    params.push(input.to);
    where.push(`d."createdAt" <= $${params.length}`);
  }
  params.push(input.limit);
  const order = rankParam
    ? `ts_rank(d."searchVector", plainto_tsquery('simple', $${rankParam})) DESC, d."updatedAt" DESC`
    : 'd."updatedAt" DESC';
  const sql = `SELECT d.id FROM "Document" d WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length}`;
  return { sql, params };
}
