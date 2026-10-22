import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CloudService } from './cloud.service';
import { RestoreDto, SyncPushDto } from './dto';

class ResolveConflictDto {
  @IsIn(['client', 'server'])
  resolution!: 'client' | 'server';
}

@Controller()
export class CloudController {
  constructor(private readonly cloud: CloudService) {}

  @Post('backup')
  backup(@CurrentUser() user: AuthUser) {
    return this.cloud.backup(user.id);
  }

  @Post('restore')
  restore(@CurrentUser() user: AuthUser, @Body() dto: RestoreDto) {
    return this.cloud.restore(user.id, dto.backupId);
  }

  @Post('sync/push')
  push(@CurrentUser() user: AuthUser, @Body() dto: SyncPushDto) {
    return this.cloud.push(user.id, dto);
  }

  @Post('sync/pull')
  pull(@CurrentUser() user: AuthUser, @Query('since') since?: string) {
    return this.cloud.pull(user.id, since);
  }

  @Get('sync/conflicts')
  conflicts(@CurrentUser() user: AuthUser) {
    return this.cloud.conflicts(user.id);
  }

  @Post('sync/conflicts/:id/resolve')
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveConflictDto,
  ) {
    return this.cloud.resolve(user.id, id, dto.resolution);
  }
}
