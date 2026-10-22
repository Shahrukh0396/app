import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamRole } from '@scanflow/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth-user';
import { TEAM_ROLES_KEY } from '../decorators/team-roles.decorator';

@Injectable()
export class TeamRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<TeamRole[] | undefined>(TEAM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      params: { id?: string; teamId?: string };
    }>();
    const teamId = request.params.teamId ?? request.params.id;
    const userId = request.user?.id;
    if (!teamId || !userId) throw new ForbiddenException('Team membership is required');
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException('Your team role cannot perform this action');
    }
    return true;
  }
}
