import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { APP_ENV, AppEnv } from '../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  configured(): boolean {
    return Boolean(this.env.smtpHost);
  }

  async sendPasswordReset(to: string, token: string): Promise<{ delivered: boolean }> {
    if (!this.env.smtpHost) {
      this.logger.log(`Password reset stored for ${to}; SMTP_HOST is not set`);
      return { delivered: false };
    }
    const from = this.env.smtpFrom ?? 'noreply@scanflow.app';
    const info = await this.transport().sendMail({
      from,
      to,
      subject: 'Reset your Scanflow password',
      text: `Use this token to reset your Scanflow password: ${token}\nIt expires in one hour.`,
    });
    return { delivered: Boolean(info.messageId) };
  }

  private transport(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.env.smtpHost,
        port: this.env.smtpPort,
        secure: this.env.smtpPort === 465,
        auth:
          this.env.smtpUser && this.env.smtpPass
            ? { user: this.env.smtpUser, pass: this.env.smtpPass }
            : undefined,
      });
    }
    return this.transporter;
  }
}
