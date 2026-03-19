import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PlatformPrismaClient } from '../database/platform.client';

interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  roleId?: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformPrisma: PlatformPrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;

    if (!user?.roleId) {
      throw new ForbiddenException('ليس لديك صلاحية للقيام بهذا الإجراء');
    }

    const role = await this.platformPrisma.role.findUnique({
      where: { id: user.roleId },
    });

    if (!role || !requiredRoles.includes(role.name)) {
      throw new ForbiddenException('ليس لديك صلاحية للقيام بهذا الإجراء');
    }

    return true;
  }
}
