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
        // Skip wrapping if controller already returned { success, data } format
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        if (data && typeof data === 'object' && 'meta' in data) {
          const { meta, ...rest } = data as Record<string, unknown>;
          return {
            success: true,
            data: rest as T,
            meta: meta as ApiResponse<T>['meta'],
          };
        }

        // Skip wrapping plain strings (e.g., webhook challenge responses)
        if (typeof data === 'string') {
          return data as unknown as ApiResponse<T>;
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
