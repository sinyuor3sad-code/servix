import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import * as nodemailer from 'nodemailer';
import { PlatformSettingsService } from '../database/platform-settings.service';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';

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

interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  username: string;
  password: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private logger = new Logger(MailService.name);
  private smtpBreaker!: CircuitBreaker<[SmtpConfig, SendEmailOptions], void>;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  onModuleInit() {
    // Email can be slow (especially with attachments), hence 30s timeout.
    this.smtpBreaker = this.circuitBreaker.createBreaker(
      'email-smtp',
      (cfg: SmtpConfig, opts: SendEmailOptions) => this.sendViaSmtpRaw(cfg, opts),
      { timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
  }

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
      await this.smtpBreaker.fire(
        { host: smtpHost, port: smtpPort, from: smtpFrom, username: smtpUsername, password: smtpPassword },
        options,
      );
      this.logger.log(`Email sent to: ${options.to}, subject: ${options.subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}: ${(err as Error).message}`);
      throw err;
    }
  }

  private async sendViaSmtpRaw(cfg: SmtpConfig, options: SendEmailOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.username, pass: cfg.password },
    });

    await transporter.sendMail({
      from: cfg.from || cfg.username,
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
  }
}
