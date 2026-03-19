import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'meta' in data) {
          const { meta, ...rest } = data as Record<string, unknown>;
          return {
            success: true,
            data: rest as T,
            meta: meta as ApiResponse<T>['meta'],
          };
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
