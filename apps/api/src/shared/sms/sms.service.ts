import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendSmsOptions {
  to: string;
  message: string;
}

@Injectable()
export class SmsService {
  private logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(options: SendSmsOptions): Promise<void> {
    // TODO: Integrate with Unifonic (Saudi SMS provider) or Twilio in production
    this.logger.log(`SMS to: ${options.to}`);
    this.logger.log(`  Message: ${options.message.substring(0, 100)}...`);
  }
}
