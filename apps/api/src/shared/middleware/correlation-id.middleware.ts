import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Try to use OpenTelemetry trace ID for unified tracing
    let correlationId = req.headers[CORRELATION_ID_HEADER] as string;

    if (!correlationId) {
      try {
        // Dynamic import to avoid hard dependency when OTEL is disabled
        const { trace } = require('@opentelemetry/api');
        const currentSpan = trace.getActiveSpan?.();
        const traceId = currentSpan?.spanContext()?.traceId;
        correlationId = traceId || randomUUID();
      } catch {
        correlationId = randomUUID();
      }
    }

    // Store on request for downstream use
    (req as any).correlationId = correlationId;

    // Return in response header
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
