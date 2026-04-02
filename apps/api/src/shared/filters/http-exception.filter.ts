import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Optional() @Inject('SENTRY_SERVICE') private readonly sentry?: { captureException: (err: unknown, ctx?: Record<string, unknown>) => void },
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'حدث خطأ داخلي';
    let details: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        code = (resp.error as string) || 'HTTP_ERROR';

        if (Array.isArray(resp.message)) {
          details = resp.message;
          message = 'بيانات غير صالحة';
          code = 'VALIDATION_ERROR';
        }
      } else {
        message = exception.message;
      }
    }

    // Report 5xx errors to Sentry (skip 4xx — those are client errors)
    if (status >= 500 && this.sentry) {
      const user = (request as unknown as Record<string, unknown>).user as Record<string, string> | undefined;
      this.sentry.captureException(exception, {
        url: request.url,
        method: request.method,
        statusCode: status,
        userId: user?.id,
        tenantId: user?.tenantId,
      });
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }
}
