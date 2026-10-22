import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { hashToken } from './auth.tokens';
import { AppEnv } from '../config/env';

function request(): Request {
  return {
    ip: '127.0.0.1',
    header: () => 'jest',
  } as unknown as Request;
}

describe('AuthService', () => {
  const env = {
    jwtAccessSecret: 'access-secret-access-secret-access',
    jwtRefreshSecret: 'refresh-secret-refresh-secret-refresh',
  } as AppEnv;

  function setup(jwtService?: JwtService) {
    const users: Array<Record<string, unknown>> = [];
    const tokens: Array<Record<string, unknown>> = [];
    const audits: Array<Record<string, unknown>> = [];
    const prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
          return (
            users.find((user) => (where.email && user.email === where.email) || (where.id && user.id === where.id)) ??
            null
          );
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const user = {
            id: 'user-1',
            avatar: null,
            role: 'USER',
            provider: 'EMAIL',
            deletedAt: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            passwordHash: null,
            ...data,
          };
          users.push(user);
          return user;
        }),
      },
      refreshToken: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (tokens.some((token) => token.tokenHash === data.tokenHash)) {
            throw new Error('Unique constraint failed on the fields: (`tokenHash`)');
          }
          const row = { id: `rt-${tokens.length + 1}`, revokedAt: null, ...data };
          tokens.push(row);
          return row;
        }),
        findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
          return tokens.find((token) => token.tokenHash === where.tokenHash) ?? null;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = tokens.find((token) => token.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      passwordResetToken: { create: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    const jwt = jwtService ?? {
      signAsync: jest.fn(async (payload: { typ: string; jti?: string; sub?: string; email?: string }) => {
        if (payload.typ === 'refresh') {
          return `refresh.${payload.jti ?? 'stable'}.${payload.sub ?? ''}`;
        }
        return `access.${payload.sub ?? ''}.${payload.email ?? ''}`;
      }),
      verifyAsync: jest.fn(),
    };
    const audit = { write: jest.fn(async (input: Record<string, unknown>) => void audits.push(input)) };
    const mail = { sendPasswordReset: jest.fn() };
    const oauth = { verifyGoogle: jest.fn(), verifyApple: jest.fn(), verifyMicrosoft: jest.fn() };
    const service = new AuthService(
      prisma as never,
      jwt as JwtService,
      audit as never,
      mail as never,
      oauth as never,
      env,
    );
    return {
      service,
      prisma,
      jwt: jwt as { signAsync: jest.Mock; verifyAsync: jest.Mock },
      audit,
      users,
      tokens,
    };
  }

  it('registers a user, hashes the password, and writes an audit event', async () => {
    const { service, users, audit, tokens } = setup();
    const result = await service.register({
      name: 'Ada',
      email: 'Ada@Example.com',
      password: 'correct-horse',
      deviceId: 'device-1234',
      request: request(),
    });
    expect(result.user.email).toBe('ada@example.com');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(15 * 60);
    expect(typeof users[0]?.passwordHash).toBe('string');
    expect(users[0]?.passwordHash).not.toBe('correct-horse');
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.register' }));
    expect(tokens).toHaveLength(1);
  });

  it('stores a distinct refresh-token hash for each issue', async () => {
    const { service, tokens } = setup(new JwtService({ secret: env.jwtAccessSecret }));
    const registered = await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct-horse',
      deviceId: 'device-1234',
      request: request(),
    });
    const loggedIn = await service.login({
      email: 'ada@example.com',
      password: 'correct-horse',
      deviceId: 'device-1234',
      request: request(),
    });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.tokenHash).not.toBe(tokens[1]?.tokenHash);
    expect(hashToken(registered.refreshToken)).toBe(tokens[0]?.tokenHash);
    expect(hashToken(loggedIn.refreshToken)).toBe(tokens[1]?.tokenHash);
    expect(registered.refreshToken).not.toBe(loggedIn.refreshToken);
  });

  it('rejects a duplicate email', async () => {
    const { service } = setup();
    await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct-horse',
      deviceId: 'device-1234',
      request: request(),
    });
    await expect(
      service.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'correct-horse',
        deviceId: 'device-1234',
        request: request(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a wrong password and audits the failure', async () => {
    const { service, audit } = setup();
    await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct-horse',
      deviceId: 'device-1234',
      request: request(),
    });
    await expect(
      service.login({
        email: 'ada@example.com',
        password: 'wrong-password',
        deviceId: 'device-1234',
        request: request(),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_failed' }));
  });

  it('rotates a refresh token and revokes the presented one', async () => {
    const { service, jwt, tokens } = setup();
    const issued = await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct-horse',
      deviceId: 'device-1234',
      request: request(),
    });
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', deviceId: 'device-1234', typ: 'refresh' });
    const rotated = await service.refresh({
      refreshToken: issued.refreshToken,
      deviceId: 'device-1234',
      request: request(),
    });
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    const original = tokens.find((token) => token.tokenHash === hashToken(issued.refreshToken));
    expect(original?.revokedAt).toBeInstanceOf(Date);
  });

  it('revokes the session family when a rotated token is reused', async () => {
    const { service, jwt, prisma, tokens } = setup();
    const issued = await service.register({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct-horse',
      deviceId: 'device-1234',
      request: request(),
    });
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', deviceId: 'device-1234', typ: 'refresh' });
    await service.refresh({
      refreshToken: issued.refreshToken,
      deviceId: 'device-1234',
      request: request(),
    });
    await expect(
      service.refresh({
        refreshToken: issued.refreshToken,
        deviceId: 'device-1234',
        request: request(),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(tokens[0]?.revokedAt).toBeInstanceOf(Date);
  });
});
