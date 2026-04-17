/**
 * SERVIX OpenTelemetry Tracing Configuration
 *
 * IMPORTANT: This file MUST be imported FIRST in main.ts,
 * before any other imports — before NestJS, before Prisma.
 *
 * It auto-instruments: HTTP, Express, PostgreSQL, Redis, IoRedis.
 * Exports traces to Jaeger via OTLP HTTP.
 *
 * Set OTEL_ENABLED=true to activate (disabled by default in dev).
 *
 * console.* is intentional here: this runs during bootstrap before the
 * Nest Logger is available.
 */
/* eslint-disable no-console */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const enabled = process.env.OTEL_ENABLED === 'true';

let sdk: NodeSDK | null = null;

if (enabled) {
  const ignorePaths = ['/api/v1/health', '/api/v1/health/live', '/api/v1/health/ready', '/metrics'];

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'servix-api',
      [ATTR_SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
      'service.instance.id': process.env.INSTANCE_ID || 'single',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_ENDPOINT || 'http://jaeger:4318/v1/traces',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => {
            return ignorePaths.some((p) => req.url?.startsWith(p));
          },
        },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
      }),
    ],
  });

  sdk.start();
  console.log('[OTEL] OpenTelemetry tracing initialized → Jaeger');

  // Graceful shutdown
  const shutdown = () => {
    sdk
      ?.shutdown()
      .then(() => console.log('[OTEL] Tracing shut down'))
      .catch((err) => console.error('[OTEL] Shutdown error', err));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  console.log('[OTEL] Tracing disabled (set OTEL_ENABLED=true to activate)');
}

export default sdk;
