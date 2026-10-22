import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [users, documents, pages, tickets, subscriptions] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.document.count({ where: { deletedAt: null } }),
      this.prisma.page.count(),
      this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.subscription.groupBy({ by: ['plan'], _count: { plan: true } }),
    ]);
    return { users, documents, pages, openTickets: tickets, plans: subscriptions };
  }

  async users() {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { subscription: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      provider: row.provider,
      plan: row.subscription?.plan ?? 'FREE',
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async subscriptions() {
    const rows = await this.prisma.subscription.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true, name: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.user.email,
      name: row.user.name,
      plan: row.plan,
      status: row.status,
      revenueCatId: row.revenueCatId,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    }));
  }

  async revenue() {
    const grouped = await this.prisma.subscription.groupBy({
      by: ['plan', 'status'],
      _count: { _all: true },
    });
    return grouped.map((row) => ({ plan: row.plan, status: row.status, count: row._count._all }));
  }

  async storage() {
    const aggregate = await this.prisma.document.aggregate({
      where: { deletedAt: null },
      _sum: { size: true, pageCount: true },
      _count: { _all: true },
    });
    const byUser = await this.prisma.document.groupBy({
      by: ['userId'],
      where: { deletedAt: null },
      _sum: { size: true },
      orderBy: { _sum: { size: 'desc' } },
      take: 20,
    });
    return {
      documents: aggregate._count._all,
      bytes: aggregate._sum.size ?? 0,
      pages: aggregate._sum.pageCount ?? 0,
      topUsers: byUser.map((row) => ({ userId: row.userId, bytes: row._sum.size ?? 0 })),
    };
  }

  async documents() {
    const rows = await this.prisma.document.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true } }, tags: true },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      email: row.user.email,
      pageCount: row.pageCount,
      size: row.size,
      documentType: row.documentType,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      tags: row.tags.map((tag) => tag.tag),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async tickets() {
    const rows = await this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true, name: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      body: row.body,
      status: row.status,
      email: row.user.email,
      name: row.user.name,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async analytics() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [newUsers, newDocuments, logins] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.document.count({ where: { createdAt: { gte: since } } }),
      this.prisma.auditLog.count({ where: { action: 'auth.login', createdAt: { gte: since } } }),
    ]);
    return { windowDays: 30, newUsers, newDocuments, logins };
  }

  async audit() {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      email: row.user?.email ?? null,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
