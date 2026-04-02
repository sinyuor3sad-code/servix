import { Injectable, Logger } from '@nestjs/common';

/**
 * Sentry service for error reporting.
 * Gracefully degrades when @sentry/node is not installed.
 */
@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);
  private sentryLib: any = null;
  private initialized = false;

  async onModuleInit(): Promise<void> {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      this.logger.log('SENTRY_DSN not set — Sentry disabled');
      return;
    }

    try {
      // Dynamic import to avoid compile-time dependency
      const moduleName = '@sentry/node';
      const Sentry = await (Function('m', 'return import(m)')(moduleName));
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
      });
      this.sentryLib = Sentry;
      this.initialized = true;
      this.logger.log('Sentry initialized successfully');
    } catch {
      this.logger.warn('Sentry package not installed — error reporting disabled');
    }
  }

  captureException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.initialized || !this.sentryLib) return;

    try {
      this.sentryLib.withScope((scope: any) => {
        if (context) {
          Object.entries(context).forEach(([key, value]: [string, unknown]) => {
            scope.setExtra(key, value);
          });
        }
        this.sentryLib.captureException(error);
      });
    } catch {
      this.logger.error('Failed to send error to Sentry');
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.initialized || !this.sentryLib) return;

    try {
      this.sentryLib.captureMessage(message, level);
    } catch {
      this.logger.error('Failed to send message to Sentry');
    }
  }
}
