import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTicketDto } from './dto';
import { SupportService } from './support.service';

@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.support.create(user.id, dto);
  }

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.support.mine(user.id);
  }
}
