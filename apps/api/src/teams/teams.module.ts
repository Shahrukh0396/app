import { Module } from '@nestjs/common';
import { TeamRolesGuard } from '../common/guards/team-roles.guard';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, TeamRolesGuard],
})
export class TeamsModule {}
