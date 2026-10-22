import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' as const };
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const database = await this.probe(() => this.prisma.$queryRaw`SELECT 1`);
    const redis = await this.probe(() => this.redis.ping());
    const ok = database === 'up' && redis === 'up';
    response.status(ok ? 200 : 503);
    return {
      status: ok ? ('ok' as const) : ('degraded' as const),
      checks: { database, redis },
    };
  }

  private async probe(run: () => Promise<unknown>): Promise<'up' | 'down'> {
    try {
      await run();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
