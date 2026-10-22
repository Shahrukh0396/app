import { SetMetadata } from '@nestjs/common';
import { TeamRole } from '@scanflow/types';

export const TEAM_ROLES_KEY = 'scanflow:team-roles';
export const TeamRoles = (...roles: TeamRole[]) => SetMetadata(TEAM_ROLES_KEY, roles);
