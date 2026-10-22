import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/auth-user';
import { UpdateNotificationsDto, UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @Put('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Get('me/notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.users.notifications(user.id);
  }

  @Put('me/notifications')
  updateNotifications(@CurrentUser() user: AuthUser, @Body() dto: UpdateNotificationsDto) {
    return this.users.updateNotifications(user.id, dto);
  }
}
