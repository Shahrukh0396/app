import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PLAN_CATALOG, Plan } from '@scanflow/types';
import { PrismaService } from '../prisma/prisma.service';
import { APP_ENV, AppEnv } from '../config/env';
import { mapRevenueCatEvent, planFromSubscriberPayload, RevenueCatEvent } from './revenuecat';
import { SubscribeDto } from './dto';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  plans() {
    return PLAN_CATALOG;
  }

  async subscribe(userId: string, dto: SubscribeDto) {
    if (!this.env.revenueCatSecretKey) {
      throw new ServiceUnavailableException(
        'RevenueCat receipt validation is not configured (REVENUECAT_SECRET_API_KEY)',
      );
    }
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(dto.appUserId)}`,
      { headers: { Authorization: `Bearer ${this.env.revenueCatSecretKey}` } },
    );
    if (!response.ok) {
      throw new UnauthorizedException('RevenueCat rejected the subscriber lookup');
    }
    const body: unknown = await response.json();
    const plan = planFromSubscriberPayload(body, dto.productId);
    const storedPlan = plan === Plan.FREE ? dto.plan : plan;
    const row = await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: storedPlan,
        status: 'ACTIVE',
        revenueCatId: dto.revenueCatId ?? dto.appUserId,
        productId: dto.productId,
      },
      update: {
        plan: storedPlan,
        status: 'ACTIVE',
        revenueCatId: dto.revenueCatId ?? dto.appUserId,
        productId: dto.productId,
      },
    });
    return {
      plan: row.plan,
      status: row.status,
      revenueCatId: row.revenueCatId,
      productId: row.productId,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }

  async handleWebhook(authorization: string | undefined, body: { event?: RevenueCatEvent }) {
    if (!this.env.revenueCatWebhookSecret) {
      throw new ServiceUnavailableException(
        'RevenueCat webhooks are not configured (REVENUECAT_WEBHOOK_SECRET)',
      );
    }
    const expected = this.env.revenueCatWebhookSecret;
    const presented = authorization ?? '';
    if (presented !== expected && presented !== `Bearer ${expected}`) {
      throw new UnauthorizedException('RevenueCat webhook authorization was rejected');
    }
    const mapped = mapRevenueCatEvent(body.event ?? {});
    if (!mapped.appUserId) {
      return { ok: true, ignored: true };
    }
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: mapped.appUserId }, { subscription: { revenueCatId: mapped.appUserId } }],
      },
    });
    if (!user) return { ok: true, ignored: true };
    await this.prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: mapped.plan,
        status: mapped.status,
        expiresAt: mapped.expiresAt,
        revenueCatId: mapped.appUserId,
        productId: mapped.productId,
      },
      update: {
        plan: mapped.plan,
        status: mapped.status,
        expiresAt: mapped.expiresAt,
        productId: mapped.productId,
        revenueCatId: mapped.appUserId,
      },
    });
    return { ok: true, plan: mapped.plan, status: mapped.status };
  }
}
