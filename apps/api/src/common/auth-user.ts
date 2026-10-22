import { UserRole } from '@scanflow/types';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  deviceId: string;
  typ: 'refresh';
  jti: string;
}
