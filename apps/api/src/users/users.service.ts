import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationPreferences } from '@scanflow/types';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser } from '../auth/auth.service';
import { UpdateNotificationsDto, UpdateProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim(),
        avatar: dto.avatar,
      },
    });
    return toPublicUser(user);
  }

  async notifications(userId: string): Promise<NotificationPreferences> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      emailEnabled: row.emailEnabled,
      pushEnabled: row.pushEnabled,
      productUpdates: row.productUpdates,
      syncAlerts: row.syncAlerts,
    };
  }

  async updateNotifications(userId: string, dto: UpdateNotificationsDto): Promise<NotificationPreferences> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    return {
      emailEnabled: row.emailEnabled,
      pushEnabled: row.pushEnabled,
      productUpdates: row.productUpdates,
      syncAlerts: row.syncAlerts,
    };
  }
}
