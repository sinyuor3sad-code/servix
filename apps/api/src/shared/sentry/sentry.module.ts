import { Module, Global } from '@nestjs/common';
import { SentryService } from './sentry.service';

/**
 * Optional Sentry integration module.
 * When SENTRY_DSN is set, it provides error reporting.
 * When not set, it provides a no-op implementation.
 */
@Global()
@Module({
  providers: [
    SentryService,
    {
      provide: 'SENTRY_SERVICE',
      useExisting: SentryService,
    },
  ],
  exports: [SentryService, 'SENTRY_SERVICE'],
})
export class SentryModule {}
