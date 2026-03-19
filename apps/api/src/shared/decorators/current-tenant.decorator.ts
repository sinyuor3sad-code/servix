import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { Tenant } from '../database';

export const CurrentTenant = createParamDecorator(
  (data: keyof Tenant | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { tenant?: Tenant }>();
    const tenant = request.tenant;
    return data && tenant ? tenant[data] : tenant;
  },
);
