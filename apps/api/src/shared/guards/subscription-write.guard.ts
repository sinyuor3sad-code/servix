import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../types/request.interface';

/**
 * Blocks POST/PUT/PATCH/DELETE when subscription is in grace period (read-only).
 * GET requests are always allowed when tenant context exists.
 */
@Injectable()
export class SubscriptionWriteGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method?.toUpperCase();

    const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (readOnlyMethods.includes(method)) return true;

    const subStatus = request.subscriptionStatus;
    if (!subStatus) return true;

    if (!subStatus.canWrite) {
      throw new ForbiddenException(
        'اشتراكك منتهي — يمكنك عرض البيانات فقط. جدّدي للاستمرار في التعديل',
      );
    }

    return true;
  }
}
