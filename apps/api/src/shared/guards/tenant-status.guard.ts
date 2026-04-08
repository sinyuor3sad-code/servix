import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard: Checks tenant status and blocks suspended tenants.
 * Should be applied globally or on tenant-specific routes.
 */
@Injectable()
export class TenantStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant) return true; // No tenant context (e.g., admin route)

    if (tenant.status === 'suspended') {
      throw new ForbiddenException({
        code: 'TENANT_SUSPENDED',
        message: 'هذا الحساب معلّق. تواصل مع الدعم الفني.',
        reason: tenant.suspendReason || undefined,
      });
    }

    if (tenant.status === 'deleted') {
      throw new ForbiddenException({
        code: 'TENANT_DELETED',
        message: 'هذا الحساب محذوف.',
      });
    }

    return true;
  }
}
