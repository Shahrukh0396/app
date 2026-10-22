import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, UserRole } from '@scanflow/types';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { APP_ENV, AppEnv } from '../config/env';
import { AccessTokenPayload, RefreshTokenPayload } from '../common/auth-user';
import { ACCESS_TTL_SECONDS, hashToken, randomToken, refreshExpiry, RESET_TTL_MS } from './auth.tokens';
import { OAuthVerifier, VerifiedIdentity } from './oauth.verifier';
import { AuthResponse, PublicUser } from '@scanflow/types';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  provider: AuthProvider;
  role: UserRole;
  createdAt: Date;
  passwordHash: string | null;
  deletedAt: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly oauth: OAuthVerifier,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
    deviceId: string;
    deviceName?: string;
    request: Request;
  }): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('An account with that email already exists');
    }
    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        provider: 'EMAIL',
        role: 'USER',
        subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
        notifications: { create: {} },
      },
    });
    await this.audit.write({
      userId: user.id,
      action: 'auth.register',
      entity: 'User',
      entityId: user.id,
      ip: input.request.ip,
      userAgent: input.request.header('user-agent'),
    });
    return this.issue(user, input.deviceId, input.deviceName, input.request);
  }

  async login(input: {
    email: string;
    password: string;
    deviceId: string;
    deviceName?: string;
    request: Request;
  }): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || user.deletedAt || !user.passwordHash) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    const matches = await argon2.verify(user.passwordHash, input.password);
    if (!matches) {
      await this.audit.write({
        userId: user.id,
        action: 'auth.login_failed',
        entity: 'User',
        entityId: user.id,
        ip: input.request.ip,
        userAgent: input.request.header('user-agent'),
      });
      throw new UnauthorizedException('Email or password is incorrect');
    }
    await this.audit.write({
      userId: user.id,
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      ip: input.request.ip,
      userAgent: input.request.header('user-agent'),
    });
    return this.issue(user, input.deviceId, input.deviceName, input.request);
  }

  async refresh(input: { refreshToken: string; deviceId: string; deviceName?: string; request: Request }): Promise<AuthResponse> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(input.refreshToken, {
        secret: this.env.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid');
    }
    if (payload.typ !== 'refresh' || payload.deviceId !== input.deviceId) {
      throw new UnauthorizedException('Refresh token is bound to another device');
    }
    const tokenHash = hashToken(input.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token is invalid');
    }
    if (stored.revokedAt) {
      // A rotated refresh token presented again means the previous token leaked. Revoke the family.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }
    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    const issued = await this.issue(user, input.deviceId, input.deviceName ?? stored.deviceName ?? undefined, input.request);
    const replacement = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(issued.refreshToken) },
    });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: replacement?.id },
    });
    return issued;
  }

  async logout(refreshToken: string, request: Request): Promise<{ ok: true }> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (stored && !stored.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      await this.audit.write({
        userId: stored.userId,
        action: 'auth.logout',
        entity: 'RefreshToken',
        entityId: stored.id,
        ip: request.ip,
        userAgent: request.header('user-agent'),
      });
    }
    return { ok: true };
  }

  async google(idToken: string, deviceId: string, deviceName: string | undefined, request: Request, name?: string) {
    const identity = await this.oauth.verifyGoogle(idToken, this.env);
    if (name) identity.name = name;
    return this.loginWithIdentity('GOOGLE', identity, deviceId, deviceName, request);
  }

  async apple(idToken: string, deviceId: string, deviceName: string | undefined, request: Request, name?: string) {
    const identity = await this.oauth.verifyApple(idToken, this.env);
    if (name) identity.name = name;
    return this.loginWithIdentity('APPLE', identity, deviceId, deviceName, request);
  }

  async microsoft(idToken: string, deviceId: string, deviceName: string | undefined, request: Request, name?: string) {
    const identity = await this.oauth.verifyMicrosoft(idToken, this.env);
    if (name) identity.name = name;
    return this.loginWithIdentity('MICROSOFT', identity, deviceId, deviceName, request);
  }

  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user && !user.deletedAt && user.passwordHash) {
      const token = randomToken();
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      await this.mail.sendPasswordReset(user.email, token);
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string): Promise<{ ok: true }> {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }
    const passwordHash = await argon2.hash(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  private async loginWithIdentity(
    provider: 'GOOGLE' | 'APPLE' | 'MICROSOFT',
    identity: VerifiedIdentity,
    deviceId: string,
    deviceName: string | undefined,
    request: Request,
  ): Promise<AuthResponse> {
    const byProvider = await this.prisma.user.findFirst({
      where: { provider, providerId: identity.providerId, deletedAt: null },
    });
    let user = byProvider;
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });
      if (byEmail && !byEmail.deletedAt) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            provider,
            providerId: identity.providerId,
            avatar: byEmail.avatar ?? identity.avatar,
            name: byEmail.name || identity.name,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            name: identity.name,
            email: identity.email,
            avatar: identity.avatar,
            provider,
            providerId: identity.providerId,
            role: 'USER',
            subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
            notifications: { create: {} },
          },
        });
      }
    }
    await this.audit.write({
      userId: user.id,
      action: `auth.${provider.toLowerCase()}`,
      entity: 'User',
      entityId: user.id,
      ip: request.ip,
      userAgent: request.header('user-agent'),
    });
    return this.issue(user, deviceId, deviceName, request);
  }

  private async issue(
    user: UserRecord,
    deviceId: string,
    deviceName: string | undefined,
    request: Request,
  ): Promise<AuthResponse> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      deviceId,
      typ: 'refresh',
      jti: randomUUID(),
    };
    const accessToken = await this.jwt.signAsync(accessPayload, { expiresIn: ACCESS_TTL_SECONDS });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.env.jwtRefreshSecret,
      expiresIn: '30d',
    });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        deviceId,
        deviceName,
        userAgent: request.header('user-agent') ?? null,
        expiresAt: refreshExpiry(),
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SECONDS,
      tokenType: 'Bearer',
      user: toPublicUser(user),
    };
  }
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  provider: AuthProvider | 'EMAIL' | 'GOOGLE' | 'APPLE' | 'MICROSOFT';
  role: UserRole | 'USER' | 'ADMIN';
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    provider: user.provider as PublicUser['provider'],
    role: user.role as PublicUser['role'],
    createdAt: user.createdAt.toISOString(),
  };
}
