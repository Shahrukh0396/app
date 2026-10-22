import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SyncEntity, SyncPullResponse, SyncPushResult } from '@scanflow/types';
import { classifyVersion } from './sync-version';
import { PrismaService } from '../prisma/prisma.service';
import { refreshSearchVector } from '../search/search-vector';
import { toDocument, toPage } from '../documents/document.mapper';
import { toFolder } from '../folders/folders.service';
import { R2Service } from '../storage/r2.service';
import { SyncPushDto } from './dto';

@Injectable()
export class CloudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async backup(userId: string) {
    const [folders, documents, pages] = await Promise.all([
      this.prisma.folder.findMany({ where: { userId } }),
      this.prisma.document.findMany({ where: { userId }, include: { tags: true } }),
      this.prisma.page.findMany({ where: { document: { userId } } }),
    ]);
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      folders: folders.map(toFolder),
      documents: documents.map((row) => toDocument(row)),
      pages: pages.map(toPage),
    };
    const encoded = Buffer.from(JSON.stringify(manifest));
    let storageKey: string | null = null;
    if (this.r2.configured()) {
      storageKey = this.r2.keyFor(userId, 'backups', `${Date.now()}.json`);
      await this.r2.put(storageKey, encoded, 'application/json');
    }
    const row = await this.prisma.backupSnapshot.create({
      data: {
        userId,
        storageKey,
        byteSize: encoded.length,
        documentCount: documents.length,
        manifest: manifest as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      id: row.id,
      storageKey,
      byteSize: row.byteSize,
      documentCount: row.documentCount,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async restore(userId: string, backupId: string) {
    const snapshot = await this.prisma.backupSnapshot.findFirst({ where: { id: backupId, userId } });
    if (!snapshot) throw new NotFoundException('Backup not found');
    const manifest = snapshot.manifest as {
      folders?: Array<{ id: string; name: string; parentFolderId: string | null; version: number }>;
      documents?: Array<{
        id: string;
        title: string;
        description: string;
        folderId: string | null;
        version: number;
        documentType: string;
        favorite: boolean;
        archived: boolean;
        tags: string[];
      }>;
    };
    let applied = 0;
    let conflicts = 0;
    for (const folder of manifest.folders ?? []) {
      const current = await this.prisma.folder.findUnique({ where: { id: folder.id } });
      if (current && current.userId !== userId) continue;
      if (current && classifyVersion(folder.version, current.version) === 'conflict') {
        conflicts += 1;
        await this.prisma.syncConflict.create({
          data: {
            userId,
            entity: SyncEntity.FOLDER,
            entityId: folder.id,
            clientVersion: folder.version,
            serverVersion: current.version,
            clientPayload: folder as unknown as Prisma.InputJsonValue,
            serverPayload: { name: current.name, version: current.version },
          },
        });
        continue;
      }
      await this.prisma.folder.upsert({
        where: { id: folder.id },
        create: {
          id: folder.id,
          userId,
          name: folder.name,
          parentFolderId: null,
          version: folder.version,
        },
        update: { name: folder.name, version: { increment: 1 } },
      });
      applied += 1;
    }
    for (const folder of manifest.folders ?? []) {
      if (folder.parentFolderId) {
        await this.prisma.folder.updateMany({
          where: { id: folder.id, userId },
          data: { parentFolderId: folder.parentFolderId },
        });
      }
    }
    for (const document of manifest.documents ?? []) {
      const current = await this.prisma.document.findUnique({ where: { id: document.id } });
      if (current && current.userId !== userId) continue;
      if (current && classifyVersion(document.version, current.version) === 'conflict') {
        conflicts += 1;
        await this.prisma.syncConflict.create({
          data: {
            userId,
            documentId: document.id,
            entity: SyncEntity.DOCUMENT,
            entityId: document.id,
            clientVersion: document.version,
            serverVersion: current.version,
            clientPayload: document as unknown as Prisma.InputJsonValue,
            serverPayload: { title: current.title, version: current.version },
          },
        });
        continue;
      }
      await this.prisma.document.upsert({
        where: { id: document.id },
        create: {
          id: document.id,
          userId,
          title: document.title,
          description: document.description ?? '',
          folderId: document.folderId,
          version: document.version,
          favorite: document.favorite,
          archived: document.archived,
        },
        update: {
          title: document.title,
          description: document.description ?? '',
          version: { increment: 1 },
        },
      });
      await refreshSearchVector(this.prisma, document.id);
      applied += 1;
    }
    return { applied, conflicts, backupId };
  }

  async push(userId: string, dto: SyncPushDto): Promise<SyncPushResult> {
    const result: SyncPushResult = { applied: [], conflicts: [] };
    for (const change of dto.changes) {
      if (change.entity !== SyncEntity.DOCUMENT) {
        throw new BadRequestException('This sync endpoint currently accepts document changes');
      }
      const current = await this.prisma.document.findUnique({ where: { id: change.id } });
      if (change.op === 'delete') {
        if (!current || current.userId !== userId) continue;
        if (classifyVersion(change.version, current.version) === 'conflict') {
          const conflict = await this.recordConflict(userId, change, current.version, { title: current.title });
          result.conflicts.push(conflict);
          continue;
        }
        await this.prisma.document.update({
          where: { id: change.id },
          data: { deletedAt: new Date(), version: { increment: 1 } },
        });
        result.applied.push({ entity: change.entity, id: change.id, version: current.version + 1 });
        continue;
      }
      if (current && current.userId !== userId) {
        throw new BadRequestException('Document belongs to another user');
      }
      if (current && classifyVersion(change.version, current.version) === 'conflict') {
        const conflict = await this.recordConflict(userId, change, current.version, {
          title: current.title,
          version: current.version,
        });
        result.conflicts.push(conflict);
        continue;
      }
      const title = stringField(change.payload, 'title') ?? current?.title ?? 'Untitled';
      const description = stringField(change.payload, 'description') ?? current?.description ?? '';
      const saved = await this.prisma.document.upsert({
        where: { id: change.id },
        create: {
          id: change.id,
          userId,
          title,
          description,
          version: 1,
        },
        update: {
          title,
          description,
          version: { increment: 1 },
        },
      });
      await refreshSearchVector(this.prisma, saved.id);
      result.applied.push({ entity: change.entity, id: saved.id, version: saved.version });
    }
    return result;
  }

  async pull(userId: string, since?: string): Promise<SyncPullResponse> {
    const cursor = since ? new Date(since) : new Date(0);
    if (Number.isNaN(cursor.getTime())) throw new BadRequestException('since is not a date');
    const [folders, documents, pages] = await Promise.all([
      this.prisma.folder.findMany({ where: { userId, updatedAt: { gt: cursor } } }),
      this.prisma.document.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        include: { tags: true },
      }),
      this.prisma.page.findMany({ where: { document: { userId }, updatedAt: { gt: cursor } } }),
    ]);
    return {
      serverTime: new Date().toISOString(),
      folders: folders.map(toFolder),
      documents: documents.map((row) => toDocument(row)),
      pages: pages.map(toPage),
    };
  }

  async conflicts(userId: string) {
    const rows = await this.prisma.syncConflict.findMany({
      where: { userId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      entity: row.entity,
      entityId: row.entityId,
      clientVersion: row.clientVersion,
      serverVersion: row.serverVersion,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async resolve(userId: string, id: string, resolution: 'client' | 'server') {
    const row = await this.prisma.syncConflict.findFirst({ where: { id, userId, resolvedAt: null } });
    if (!row) throw new NotFoundException('Conflict not found');
    if (resolution === 'client' && row.entity === SyncEntity.DOCUMENT && row.documentId) {
      const payload = row.clientPayload as { title?: string; description?: string };
      await this.prisma.document.update({
        where: { id: row.documentId },
        data: {
          title: payload.title,
          description: payload.description,
          version: { increment: 1 },
        },
      });
      await refreshSearchVector(this.prisma, row.documentId);
    }
    await this.prisma.syncConflict.update({
      where: { id },
      data: { resolvedAt: new Date(), resolution },
    });
    return { ok: true as const };
  }

  private async recordConflict(
    userId: string,
    change: SyncPushDto['changes'][number],
    serverVersion: number,
    serverPayload: Prisma.InputJsonValue,
  ) {
    const row = await this.prisma.syncConflict.create({
      data: {
        userId,
        documentId: change.entity === SyncEntity.DOCUMENT ? change.id : null,
        entity: change.entity,
        entityId: change.id,
        clientVersion: change.version,
        serverVersion,
        clientPayload: change.payload as Prisma.InputJsonValue,
        serverPayload,
      },
    });
    return {
      id: row.id,
      entity: change.entity,
      entityId: change.id,
      clientVersion: change.version,
      serverVersion,
    };
  }
}

function stringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}
