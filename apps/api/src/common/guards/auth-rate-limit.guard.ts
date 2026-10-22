import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APP_ENV, AppEnv } from '../../config/env';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ ip?: string; headers: Record<string, string | undefined> }>();
    const forwarded = request.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) || request.ip || 'unknown';
    try {
      const count = await this.redis.incrWithTtl(`rl:auth:${ip}`, this.env.authRateWindowSeconds);
      if (count > this.env.authRateLimit) {
        throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Auth rate limiter could not reach Redis');
    }
  }
}
