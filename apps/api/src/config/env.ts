export interface AppEnv {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  corsOrigins: string[];
  publicApiUrl: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
  r2Endpoint?: string;
  googleClientId?: string;
  appleClientId?: string;
  microsoftClientId?: string;
  revenueCatSecretKey?: string;
  revenueCatWebhookSecret?: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  authRateLimit: number;
  authRateWindowSeconds: number;
}

export const APP_ENV = Symbol('APP_ENV');

function optional(source: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = source[name];
  if (!value || value.trim() === '') return undefined;
  return value.trim();
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = optional(source, name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const port = Number(source.PORT ?? 3000);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('PORT must be a positive number');
  }
  return {
    nodeEnv: source.NODE_ENV ?? 'development',
    port,
    databaseUrl: required(source, 'DATABASE_URL'),
    redisUrl: optional(source, 'REDIS_URL') ?? 'redis://127.0.0.1:6379',
    jwtAccessSecret: required(source, 'JWT_ACCESS_SECRET'),
    jwtRefreshSecret: required(source, 'JWT_REFRESH_SECRET'),
    corsOrigins: (source.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:8080')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    publicApiUrl: (optional(source, 'PUBLIC_API_URL') ?? 'http://localhost:3000').replace(/\/$/, ''),
    r2AccessKeyId: optional(source, 'R2_ACCESS_KEY_ID'),
    r2SecretAccessKey: optional(source, 'R2_SECRET_ACCESS_KEY'),
    r2Bucket: optional(source, 'R2_BUCKET'),
    r2Endpoint: optional(source, 'R2_ENDPOINT'),
    googleClientId: optional(source, 'GOOGLE_CLIENT_ID'),
    appleClientId: optional(source, 'APPLE_CLIENT_ID'),
    microsoftClientId: optional(source, 'MICROSOFT_CLIENT_ID'),
    revenueCatSecretKey: optional(source, 'REVENUECAT_SECRET_API_KEY'),
    revenueCatWebhookSecret: optional(source, 'REVENUECAT_WEBHOOK_SECRET'),
    smtpHost: optional(source, 'SMTP_HOST'),
    smtpPort: Number(source.SMTP_PORT ?? 587),
    smtpUser: optional(source, 'SMTP_USER'),
    smtpPass: optional(source, 'SMTP_PASS'),
    smtpFrom: optional(source, 'SMTP_FROM'),
    authRateLimit: Number(source.AUTH_RATE_LIMIT ?? 20),
    authRateWindowSeconds: Number(source.AUTH_RATE_WINDOW_SECONDS ?? 60),
  };
}
