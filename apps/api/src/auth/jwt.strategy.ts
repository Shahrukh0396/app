import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@scanflow/types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload, AuthUser } from '../common/auth-user';
import { APP_ENV, AppEnv } from '../config/env';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(APP_ENV) env: AppEnv) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtAccessSecret,
    });
  }

  validate(payload: AccessTokenPayload): AuthUser {
    if (payload.typ !== 'access' || !payload.sub || !payload.email) {
      throw new UnauthorizedException();
    }
    const role = payload.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER;
    return { id: payload.sub, email: payload.email, role };
  }
}
