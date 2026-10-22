import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RevenueCatEvent } from './revenuecat';
import { SubscribeDto } from './dto';
import { SubscriptionService } from './subscription.service';

@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.subscriptions.plans();
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.subscriptions.subscribe(user.id, dto);
  }

  @Public()
  @Post('webhooks/revenuecat')
  webhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { event?: RevenueCatEvent },
  ) {
    return this.subscriptions.handleWebhook(authorization, body);
  }
}
