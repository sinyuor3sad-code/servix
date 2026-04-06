import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

// Sentry decorator — optional, only if @sentry/nestjs is installed
let SentryExceptionCaptured: () => MethodDecorator;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sentry = require('@sentry/nestjs');
  SentryExceptionCaptured = sentry.SentryExceptionCaptured;
} catch {
  // Sentry not installed — use a no-op decorator
  SentryExceptionCaptured = () => (_target: any, _key: string | symbol, descriptor: PropertyDescriptor) => descriptor;
}

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
  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

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
