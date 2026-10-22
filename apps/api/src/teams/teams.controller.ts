import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { TeamRole } from '@scanflow/types';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TeamRoles } from '../common/decorators/team-roles.decorator';
import { TeamRolesGuard } from '../common/guards/team-roles.guard';
import { UseGuards } from '@nestjs/common';
import { AcceptInviteDto, CreateTeamDto, InviteDto } from './dto';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamDto) {
    return this.teams.create(user.id, dto);
  }

  @Post(':id/invite')
  @UseGuards(TeamRolesGuard)
  @TeamRoles(TeamRole.OWNER, TeamRole.ADMIN)
  invite(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InviteDto) {
    return this.teams.invite(id, dto);
  }

  @Get(':id/members')
  @UseGuards(TeamRolesGuard)
  @TeamRoles(TeamRole.OWNER, TeamRole.ADMIN, TeamRole.EDITOR, TeamRole.VIEWER)
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.teams.members(id);
  }

  @Post('invites/accept')
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
    return this.teams.accept(user.id, dto);
  }
}
