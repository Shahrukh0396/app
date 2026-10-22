import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTicketDto) {
    const row = await this.prisma.supportTicket.create({
      data: { userId, subject: dto.subject.trim(), body: dto.body.trim() },
    });
    return {
      id: row.id,
      subject: row.subject,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async mine(userId: string) {
    const rows = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      body: row.body,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
