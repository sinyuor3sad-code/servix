import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../../shared/guards';
import { RequirePermission } from '../../../shared/decorators';
import { AuthenticatedRequest } from '../../../shared/types';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
import { ManagerOverrideRequestDto } from './dto/manager-override.dto';
import { PosCheckoutService } from './pos-checkout.service';
import { ManagerOverrideService } from './manager-override.service';

@ApiTags('POS Checkout')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'pos', version: '1' })
export class PosCheckoutController {
  constructor(
    private readonly posCheckoutService: PosCheckoutService,
    private readonly managerOverrideService: ManagerOverrideService,
  ) {}

  @Post('manager-override')
  @RequirePermission('invoices.discount')
  @ApiOperation({
    summary: 'Manager approval for cashier discount override',
    description: 'Verifies a manager/owner password and returns a 5-minute JWT bound to the requested discount %. The token is then submitted with /pos/checkout to authorise discounts above the cashier role limit.',
  })
  @ApiResponse({ status: 201, description: 'Approval issued' })
  @ApiResponse({ status: 401, description: 'Manager password rejected' })
  @ApiResponse({ status: 403, description: 'No active manager/owner found for this tenant' })
  async requestManagerOverride(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ManagerOverrideRequestDto,
  ): Promise<Record<string, unknown>> {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return { success: false, message: 'Tenant context is required' };
    }
    const data = await this.managerOverrideService.requestApproval(tenantId, req.user.sub, dto);
    return { success: true, data, message: 'Manager approval issued' };
  }

  @Post('checkout')
  @RequirePermission('invoices.create')
  @ApiOperation({
    summary: 'Atomic POS checkout',
    description: 'Creates a paid POS invoice, payments, discounts, coupon redemption, and receipt snapshot atomically.',
  })
  @ApiResponse({ status: 201, description: 'Checkout completed' })
  @ApiResponse({ status: 400, description: 'Invalid checkout command' })
  @ApiResponse({ status: 409, description: 'Idempotency key conflict or in-progress checkout' })
  async checkout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PosCheckoutDto,
  ): Promise<Record<string, unknown>> {
    const data = await this.posCheckoutService.checkout(
      req.tenantDb!,
      dto,
      req.user.sub,
      req.tenant?.id,
    );

    return {
      success: true,
      data,
      message: 'POS checkout completed',
    };
  }
}
