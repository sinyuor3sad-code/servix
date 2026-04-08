import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.recordMetrics(req, ctx.getResponse<Response>(), startTime),
        error: () => this.recordMetrics(req, ctx.getResponse<Response>(), startTime),
      }),
    );
  }

  private recordMetrics(req: Request, res: Response, startTime: bigint) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
    const route = this.normalizeRoute(req.route?.path || req.path);
    const method = req.method;
    const statusCode = String(res.statusCode);

    this.metrics.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.metrics.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  /**
   * Normalize route paths to avoid high-cardinality labels.
   * /api/v1/appointments/abc-123 → /api/v1/appointments/:id
   */
  private normalizeRoute(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:num');
  }
}
