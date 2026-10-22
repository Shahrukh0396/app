import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@scanflow/types';

export const ROLES_KEY = 'scanflow:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
