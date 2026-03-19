import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly configService: ConfigService) {}

  async send(options: SendEmailOptions): Promise<void> {
    // TODO: Integrate with SendGrid, Resend, or AWS SES in production
    this.logger.log(`Email to: ${options.to}`);
    this.logger.log(`  Subject: ${options.subject}`);
    this.logger.log(`  Body: ${options.body.substring(0, 100)}...`);
    if (options.attachments?.length) {
      this.logger.log(`  Attachments: ${options.attachments.map((a) => a.filename).join(', ')}`);
    }
  }
}
