import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@scanflow/types';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.dashboard();
  }

  @Get('users')
  users() {
    return this.admin.users();
  }

  @Get('subscriptions')
  subscriptions() {
    return this.admin.subscriptions();
  }

  @Get('revenue')
  revenue() {
    return this.admin.revenue();
  }

  @Get('storage')
  storage() {
    return this.admin.storage();
  }

  @Get('documents')
  documents() {
    return this.admin.documents();
  }

  @Get('tickets')
  tickets() {
    return this.admin.tickets();
  }

  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }

  @Get('audit')
  audit() {
    return this.admin.audit();
  }
}
