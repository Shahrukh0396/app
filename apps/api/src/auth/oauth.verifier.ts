import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppEnv } from '../config/env';

export interface VerifiedIdentity {
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

interface GoogleTokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: string | boolean;
}

const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const microsoftJwks = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'),
);

@Injectable()
export class OAuthVerifier {
  async verifyGoogle(idToken: string, env: AppEnv): Promise<VerifiedIdentity> {
    if (!env.googleClientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured (GOOGLE_CLIENT_ID)');
    }
    const url = new URL('https://oauth2.googleapis.com/tokeninfo');
    url.searchParams.set('id_token', idToken);
    const response = await fetch(url);
    if (!response.ok) {
      throw new UnauthorizedException('Google token was rejected');
    }
    const body = (await response.json()) as GoogleTokenInfo;
    if (body.aud !== env.googleClientId) {
      throw new UnauthorizedException('Google token audience mismatch');
    }
    if (!body.sub || !body.email) {
      throw new UnauthorizedException('Google token is missing identity');
    }
    const verified = body.email_verified === true || body.email_verified === 'true';
    if (!verified) {
      throw new UnauthorizedException('Google email is not verified');
    }
    return {
      providerId: body.sub,
      email: body.email.toLowerCase(),
      name: body.name?.trim() || body.email,
      avatar: body.picture ?? null,
    };
  }

  async verifyApple(identityToken: string, env: AppEnv): Promise<VerifiedIdentity> {
    if (!env.appleClientId) {
      throw new ServiceUnavailableException('Apple sign-in is not configured (APPLE_CLIENT_ID)');
    }
    try {
      const { payload } = await jwtVerify(identityToken, appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: env.appleClientId,
      });
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      if (!sub || !email) {
        throw new UnauthorizedException('Apple token is missing identity');
      }
      return { providerId: sub, email, name: email, avatar: null };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new UnauthorizedException('Apple token was rejected');
    }
  }

  async verifyMicrosoft(idToken: string, env: AppEnv): Promise<VerifiedIdentity> {
    if (!env.microsoftClientId) {
      throw new ServiceUnavailableException('Microsoft sign-in is not configured (MICROSOFT_CLIENT_ID)');
    }
    try {
      const { payload } = await jwtVerify(idToken, microsoftJwks, {
        audience: env.microsoftClientId,
      });
      const issuer = typeof payload.iss === 'string' ? payload.iss : '';
      const trusted =
        issuer.startsWith('https://login.microsoftonline.com/') ||
        issuer.startsWith('https://sts.windows.net/');
      if (!trusted) {
        throw new UnauthorizedException('Microsoft token issuer was rejected');
      }
      const emailValue = payload.email ?? payload.preferred_username;
      const email = typeof emailValue === 'string' ? emailValue.toLowerCase() : '';
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name : email;
      if (!sub || !email) {
        throw new UnauthorizedException('Microsoft token is missing identity');
      }
      return { providerId: sub, email, name, avatar: null };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new UnauthorizedException('Microsoft token was rejected');
    }
  }
}
