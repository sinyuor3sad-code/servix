import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ZatcaService } from './zatca.service';
import { ZatcaOnboardDto } from './dto/onboard.dto';
import { TenantGuard } from '@shared/guards';
import { AuthenticatedRequest } from '@shared/types';

@ApiTags('ZATCA')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'zatca', version: '1' })
export class ZatcaController {
  constructor(private readonly zatcaService: ZatcaService) {}

  @Post('onboard')
  @ApiOperation({ summary: 'Onboard salon (CSR / CSID)' })
  @ApiResponse({ status: 201 })
  async onboard(@Req() req: AuthenticatedRequest, @Body() dto: ZatcaOnboardDto) {
    const data = await this.zatcaService.onboard(req.tenantDb!, dto);
    return { success: true, data, message: 'ZATCA onboard initiated' };
  }

  @Post('invoices/:invoiceId/submit')
  @ApiOperation({ summary: 'Submit invoice to ZATCA' })
  @ApiParam({ name: 'invoiceId' })
  @ApiResponse({ status: 201 })
  async submit(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    const data = await this.zatcaService.submitInvoice(req.tenantDb!, invoiceId);
    return { success: true, data, message: 'Invoice submitted' };
  }

  @Get('invoices/:invoiceId/status')
  @ApiOperation({ summary: 'ZATCA submission status' })
  @ApiParam({ name: 'invoiceId' })
  @ApiResponse({ status: 200 })
  async status(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    const data = await this.zatcaService.getSubmissionStatus(req.tenantDb!, invoiceId);
    return { success: true, data, message: 'Submission status' };
  }

  @Get('invoices/:invoiceId/qr')
  @ApiOperation({ summary: 'Invoice QR code payload' })
  @ApiParam({ name: 'invoiceId' })
  @ApiResponse({ status: 200 })
  async qr(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    const data = await this.zatcaService.getQrForInvoice(req.tenantDb!, invoiceId);
    return { success: true, data, message: 'QR payload' };
  }

  @Get('certificates')
  @ApiOperation({ summary: 'List ZATCA certificates' })
  @ApiResponse({ status: 200 })
  async certificates(@Req() req: AuthenticatedRequest) {
    const data = await this.zatcaService.listCertificates(req.tenantDb!);
    return { success: true, data, message: 'Certificates' };
  }
}
