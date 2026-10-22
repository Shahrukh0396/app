import { PrismaService } from '../prisma/prisma.service';

export async function refreshSearchVector(prisma: PrismaService, documentId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Document" AS d
    SET "searchVector" =
      setweight(to_tsvector('simple', coalesce(d.title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(d.description, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(d."ocrText", '')), 'C') ||
      setweight(to_tsvector('simple', coalesce((
        SELECT string_agg(tag, ' ') FROM "DocumentTag" AS t WHERE t."documentId" = d.id
      ), '')), 'A')
    WHERE d.id = ${documentId}
  `;
}
