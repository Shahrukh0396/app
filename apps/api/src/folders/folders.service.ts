import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FolderRecord, FolderTreeNode } from '@scanflow/types';
import { Folder } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildFolderTree, collectDescendantIds } from './folder-tree';
import { CreateFolderDto, UpdateFolderDto } from './dto';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, deleted = false): Promise<FolderRecord[]> {
    const rows = await this.prisma.folder.findMany({
      where: { userId, deletedAt: deleted ? { not: null } : null },
      orderBy: { name: 'asc' },
    });
    return rows.map(toFolder);
  }

  async tree(userId: string): Promise<FolderTreeNode[]> {
    const rows = await this.list(userId, false);
    return buildFolderTree(rows);
  }

  async create(userId: string, dto: CreateFolderDto): Promise<FolderRecord> {
    if (dto.parentFolderId) await this.requireOwned(userId, dto.parentFolderId);
    const row = await this.prisma.folder.create({
      data: { userId, name: dto.name.trim(), parentFolderId: dto.parentFolderId ?? null },
    });
    return toFolder(row);
  }

  async update(userId: string, id: string, dto: UpdateFolderDto): Promise<FolderRecord> {
    await this.requireOwned(userId, id);
    if (dto.parentFolderId) {
      if (dto.parentFolderId === id) throw new BadRequestException('A folder cannot parent itself');
      const all = await this.prisma.folder.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true, parentFolderId: true },
      });
      const descendants = new Set(collectDescendantIds(all, id));
      if (descendants.has(dto.parentFolderId)) {
        throw new BadRequestException('A folder cannot move under its own descendant');
      }
      await this.requireOwned(userId, dto.parentFolderId);
    }
    const row = await this.prisma.folder.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        parentFolderId: dto.parentFolderId,
        version: { increment: 1 },
      },
    });
    return toFolder(row);
  }

  async softDelete(userId: string, id: string): Promise<{ ok: true; ids: string[] }> {
    await this.requireOwned(userId, id);
    const all = await this.prisma.folder.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, name: true, parentFolderId: true },
    });
    const ids = collectDescendantIds(all, id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.folder.updateMany({
        where: { id: { in: ids }, userId },
        data: { deletedAt: now, version: { increment: 1 } },
      }),
      this.prisma.document.updateMany({
        where: { userId, folderId: { in: ids }, deletedAt: null },
        data: { deletedAt: now, version: { increment: 1 } },
      }),
    ]);
    return { ok: true, ids };
  }

  async requireOwned(userId: string, id: string): Promise<Folder> {
    const folder = await this.prisma.folder.findFirst({ where: { id, userId, deletedAt: null } });
    if (!folder) throw new NotFoundException('Folder not found');
    return folder;
  }
}

export function toFolder(row: Folder): FolderRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    parentFolderId: row.parentFolderId,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
