import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType } from '@scanflow/types';
import { PrismaService } from '../prisma/prisma.service';
import { toDocument } from '../documents/document.mapper';
import { assertDocumentType, buildDocumentSearch } from './search-query';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, raw: { q?: string; type?: string; tag?: string; from?: string; to?: string }) {
    let type: DocumentType | undefined;
    try {
      type = assertDocumentType(raw.type);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid type');
    }
    const from = raw.from ? new Date(raw.from) : undefined;
    const to = raw.to ? new Date(raw.to) : undefined;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('from is not a date');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('to is not a date');
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const built = buildDocumentSearch({
      userId,
      teamIds: memberships.map((row) => row.teamId),
      q: raw.q,
      type,
      tag: raw.tag,
      from,
      to,
      limit: 50,
    });
    const ids = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(built.sql, ...built.params);
    const rows = await this.prisma.document.findMany({
      where: { id: { in: ids.map((row) => row.id) } },
      include: { tags: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const documents = ids
      .map((row) => byId.get(row.id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => toDocument(row));
    const query = raw.q?.trim();
    if (query) {
      await this.prisma.recentSearch.create({ data: { userId, query } });
      const recent = await this.prisma.recentSearch.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 20,
      });
      if (recent.length > 0) {
        await this.prisma.recentSearch.deleteMany({ where: { id: { in: recent.map((row) => row.id) } } });
      }
    }
    return { documents, query: query ?? '' };
  }

  async recent(userId: string) {
    const rows = await this.prisma.recentSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => ({ id: row.id, query: row.query, createdAt: row.createdAt.toISOString() }));
  }
}
