import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PlatformSettingsService } from '../database/platform-settings.service';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
}

@Injectable()
export class MailService {
  private logger = new Logger(MailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Send email using SMTP settings from platform_settings table.
   * Falls back to logging if no SMTP credentials are configured.
   */
  async send(options: SendEmailOptions): Promise<void> {
    const smtpHost = await this.platformSettings.get('smtp_host', '');
    const smtpPort = await this.platformSettings.getNumber('smtp_port', 587);
    const smtpFrom = await this.platformSettings.get('smtp_from', '');
    const smtpUsername = await this.platformSettings.get('smtp_username', '');
    const smtpPassword = await this.platformSettings.get('smtp_password', '');

    // If SMTP is not configured, log the email and return
    if (!smtpHost || !smtpUsername || !smtpPassword) {
      this.logger.warn(`[MailService] SMTP not configured — email logged only`);
      this.logger.log(`  To: ${options.to}`);
      this.logger.log(`  Subject: ${options.subject}`);
      this.logger.log(`  Body: ${options.body.substring(0, 100)}...`);
      if (options.attachments?.length) {
        this.logger.log(`  Attachments: ${options.attachments.map((a) => a.filename).join(', ')}`);
      }
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUsername,
          pass: smtpPassword,
        },
      });

      await transporter.sendMail({
        from: smtpFrom || smtpUsername,
        to: options.to,
        subject: options.subject,
        text: options.body,
        html: options.html || options.body,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      this.logger.log(`Email sent to: ${options.to}, subject: ${options.subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}: ${(err as Error).message}`);
      throw err;
    }
  }
}
