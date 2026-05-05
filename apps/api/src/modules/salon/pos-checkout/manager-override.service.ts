import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';

const APPROVER_ROLES = ['owner', 'manager'] as const;
const TOKEN_TTL_SECONDS = 5 * 60;
const TOKEN_PURPOSE = 'pos_manager_override';

interface OverrideTokenPayload {
  purpose: typeof TOKEN_PURPOSE;
  tenantId: string;
  approverUserId: string;
  approverName: string;
  discountPercent: number;
  reason: string;
}

export interface OverrideRequestResult {
  token: string;
  expiresAt: string;
  approvedBy: { id: string; fullName: string };
}

export interface VerifiedOverride {
  approverUserId: string;
  approverName: string;
  discountPercent: number;
  reason: string;
}

/**
 * Server-side manager approval for cashier discount overrides.
 *
 * Flow:
 *   1. Cashier needs to apply a discount above their role limit.
 *   2. Manager/owner enters their password on the cashier device.
 *   3. Server verifies the password against an active manager/owner of the
 *      same tenant (excluding the cashier themselves), then issues a
 *      short-lived JWT bound to the approver, the tenant, and the requested
 *      discount %.
 *   4. POS checkout submits this token; the checkout service verifies it
 *      before applying the excess discount and writes the approver into the
 *      audit log.
 *
 * The token is single-purpose (not interchangeable with login tokens) and
 * lives only 5 minutes — enough to complete the sale, short enough to limit
 * abuse if it leaks.
 */
@Injectable()
export class ManagerOverrideService {
  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly jwtService: JwtService,
  ) {}

  async requestApproval(
    tenantId: string,
    callerUserId: string,
    dto: { password: string; discountPercent: number; reason: string },
  ): Promise<OverrideRequestResult> {
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('سبب الخصم مطلوب');
    if (dto.discountPercent <= 0 || dto.discountPercent > 100) {
      throw new BadRequestException('نسبة الخصم غير صالحة');
    }

    const candidates = await this.platformDb.tenantUser.findMany({
      where: {
        tenantId,
        status: 'active',
        userId: { not: callerUserId },
        role: { name: { in: [...APPROVER_ROLES] } },
      },
      include: {
        user: { select: { id: true, fullName: true, passwordHash: true } },
        role: { select: { name: true } },
      },
    });

    if (candidates.length === 0) {
      throw new ForbiddenException('لا توجد مديرة/مالكة لاعتماد الخصم');
    }

    let approver: { id: string; fullName: string } | null = null;
    for (const cand of candidates) {
      if (!cand.user?.passwordHash) continue;
      const ok = await compare(dto.password, cand.user.passwordHash);
      if (ok) {
        approver = { id: cand.user.id, fullName: cand.user.fullName };
        break;
      }
    }

    if (!approver) {
      throw new UnauthorizedException('كلمة مرور المديرة غير صحيحة');
    }

    const payload: OverrideTokenPayload = {
      purpose: TOKEN_PURPOSE,
      tenantId,
      approverUserId: approver.id,
      approverName: approver.fullName,
      discountPercent: dto.discountPercent,
      reason,
    };
    const token = await this.jwtService.signAsync(payload, { expiresIn: TOKEN_TTL_SECONDS });
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();

    return { token, expiresAt, approvedBy: approver };
  }

  /**
   * Verify a manager override token submitted with a checkout. Throws if the
   * token is invalid, expired, scoped to a different tenant, or below the
   * actual discount being applied.
   */
  async verify(token: string, tenantId: string, actualDiscountPercent: number): Promise<VerifiedOverride> {
    let payload: OverrideTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<OverrideTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('رمز اعتماد المديرة غير صالح أو منتهي');
    }

    if (payload.purpose !== TOKEN_PURPOSE) {
      throw new UnauthorizedException('نوع الرمز غير مدعوم');
    }
    if (payload.tenantId !== tenantId) {
      throw new ForbiddenException('رمز اعتماد المديرة لمستأجر مختلف');
    }
    // Allow tiny rounding tolerance (0.5%) — discount may shift slightly
    // between the request and the final checkout because of cart edits.
    if (actualDiscountPercent > payload.discountPercent + 0.5) {
      throw new ForbiddenException('الخصم المطبَّق يتجاوز النسبة المعتمَدة');
    }

    return {
      approverUserId: payload.approverUserId,
      approverName: payload.approverName,
      discountPercent: payload.discountPercent,
      reason: payload.reason,
    };
  }
}
