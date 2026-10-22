import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamRole } from '@scanflow/types';
import { hashToken, randomToken } from '../auth/auth.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInviteDto, CreateTeamDto, InviteDto } from './dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: {
        name: dto.name.trim(),
        ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { members: true },
    });
    return {
      id: team.id,
      name: team.name,
      ownerId: team.ownerId,
      createdAt: team.createdAt.toISOString(),
    };
  }

  async invite(teamId: string, dto: InviteDto) {
    if (dto.role === TeamRole.OWNER) {
      throw new BadRequestException('Owner role cannot be invited');
    }
    const token = randomToken();
    const row = await this.prisma.teamInvite.create({
      data: {
        teamId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      token,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async members(teamId: string) {
    const rows = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      user: row.user,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async accept(userId: string, dto: AcceptInviteDto) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { tokenHash: hashToken(dto.token) } });
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Invite is invalid or expired');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invite.email) {
      throw new BadRequestException('This invite was sent to a different email');
    }
    await this.prisma.$transaction([
      this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: invite.teamId, userId } },
        create: { teamId: invite.teamId, userId, role: invite.role },
        update: { role: invite.role },
      }),
      this.prisma.teamInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);
    return { ok: true as const, teamId: invite.teamId, role: invite.role };
  }
}
