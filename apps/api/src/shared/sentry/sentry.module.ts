import { Module, Global, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentryService } from './sentry.service';

@Global()
@Module({
  providers: [SentryService],
  exports: [SentryService],
})
export class SentryModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    if (!dsn) return;

    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      tracesSampleRate: this.configService.get<string>('NODE_ENV') === 'production' ? 0.2 : 1.0,
      // Don't send PII (names, emails) to Sentry
      sendDefaultPii: false,
    });
  }
}
