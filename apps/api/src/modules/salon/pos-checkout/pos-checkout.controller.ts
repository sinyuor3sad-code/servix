import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../../shared/guards';
import { AuthenticatedRequest } from '../../../shared/types';
import { PosCheckoutDto } from './dto/pos-checkout.dto';
import { PosCheckoutService } from './pos-checkout.service';

@ApiTags('POS Checkout')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'pos', version: '1' })
export class PosCheckoutController {
  constructor(private readonly posCheckoutService: PosCheckoutService) {}

  @Post('checkout')
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
