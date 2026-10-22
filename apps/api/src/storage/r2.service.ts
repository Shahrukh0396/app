import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { APP_ENV, AppEnv } from '../config/env';

@Injectable()
export class R2Service {
  private client: S3Client | null = null;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  configured(): boolean {
    return Boolean(
      this.env.r2AccessKeyId && this.env.r2SecretAccessKey && this.env.r2Bucket && this.env.r2Endpoint,
    );
  }

  keyFor(userId: string, ...parts: string[]): string {
    const safe = parts.map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '_'));
    return ['users', userId, ...safe].join('/');
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    await this.sdk().send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: body,
        ContentType: mime,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.sdk().send(
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      }),
    );
    if (!response.Body) {
      throw new ServiceUnavailableException(`Object ${key} had an empty body`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.sdk().send(
      new DeleteObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      }),
    );
  }

  async presignGet(key: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(
      this.sdk(),
      new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
      { expiresIn },
    );
  }

  async presignPut(key: string, mime: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(
      this.sdk(),
      new PutObjectCommand({ Bucket: this.bucket(), Key: key, ContentType: mime }),
      { expiresIn },
    );
  }

  private bucket(): string {
    if (!this.env.r2Bucket) {
      throw new ServiceUnavailableException('Object storage is not configured (R2_BUCKET)');
    }
    return this.env.r2Bucket;
  }

  private sdk(): S3Client {
    if (!this.configured() || !this.env.r2Endpoint || !this.env.r2AccessKeyId || !this.env.r2SecretAccessKey) {
      throw new ServiceUnavailableException(
        'Object storage is not configured (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)',
      );
    }
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: this.env.r2Endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.env.r2AccessKeyId,
          secretAccessKey: this.env.r2SecretAccessKey,
        },
      });
    }
    return this.client;
  }
}
