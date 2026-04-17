import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ZatcaService } from './zatca.service';

@ApiTags('ZATCA')
@ApiBearerAuth()
@Controller({ path: 'zatca', version: '1' })
export class ZatcaController {
  private readonly logger = new Logger(ZatcaController.name);

  constructor(private readonly zatcaService: ZatcaService) {}

  /**
   * Register salon device with ZATCA
   */
  @Post('onboard')
  async onboard(
    @Body() body: { tenantId: string; tenantName: string; otp: string },
  ) {
    return this.zatcaService.onboardDevice(
      body.tenantId,
      body.tenantName,
      body.otp,
    );
  }

  /**
   * Get ZATCA registration status
   */
  @Get('status')
  async getStatus(@Body() body: { tenantId: string }) {
    return this.zatcaService.getStatus(body.tenantId);
  }

  /**
   * Test invoice submission to ZATCA sandbox
   */
  @Post('test-invoice')
  async testInvoice(@Body() body: { tenantId: string }) {
    const testData = this.zatcaService.buildInvoiceData(
      {
        id: 'test-' + Date.now(),
        invoiceNumber: 'TEST-001',
        createdAt: new Date(),
      },
      {
        nameAr: 'صالون تجريبي',
        nameEn: 'Test Salon',
        vatNumber: '300000000000003',
        commercialRegistration: '1010000000',
        address: {
          street: 'شارع الملك فهد',
          city: 'الرياض',
          district: 'العليا',
          postalCode: '12345',
        },
      },
      [
        { name: 'قص شعر', quantity: 1, price: 50, amount: 50 },
        { name: 'صبغة شعر', quantity: 1, price: 200, amount: 200 },
      ],
    );

    return this.zatcaService.generateAndReport(body.tenantId, testData);
  }
}
