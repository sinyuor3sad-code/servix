import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SentryService {
  private enabled = false;

  constructor(private readonly configService: ConfigService) {
    this.enabled = !!this.configService.get<string>('SENTRY_DSN');
  }

  async captureException(
    error: unknown,
    context?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const Sentry = await import('@sentry/node');
      if (context) {
        Sentry.withScope((scope) => {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
          Sentry.captureException(error);
        });
      } else {
        Sentry.captureException(error);
      }
    } catch {
      // Sentry itself failed — don't crash the app
    }
  }

  async captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const Sentry = await import('@sentry/node');
      Sentry.captureMessage(message, level);
    } catch {
      // Sentry itself failed — don't crash the app
    }
  }
}
