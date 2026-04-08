import { Controller, Get, Patch, Delete, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DataRightsService } from './data-rights.service';

/**
 * PDPL (Personal Data Protection Law) Controller
 * Provides data subject rights as required by Saudi PDPL regulations:
 * - Right of access (GET /my-data)
 * - Right of correction (PATCH /my-data)
 * - Right of erasure (DELETE /my-data)
 */
@ApiTags('Data Rights')
@ApiBearerAuth()
@Controller({ path: 'data-rights', version: '1' })
export class DataRightsController {
  private readonly logger = new Logger(DataRightsController.name);

  constructor(private readonly dataRightsService: DataRightsService) {}

  /**
   * Export all personal data for the requesting user (PDPL Art. 14)
   */
  @Get('my-data')
  async exportMyData(@Body() body: { userId: string; tenantId: string }) {
    this.logger.log(`Data export requested by user ${body.userId}`);
    return this.dataRightsService.exportAll(body.userId, body.tenantId);
  }

  /**
   * Correct personal data (PDPL Art. 15)
   */
  @Patch('my-data')
  async correctMyData(
    @Body() body: { userId: string; corrections: Record<string, any> },
  ) {
    this.logger.log(`Data correction requested by user ${body.userId}`);
    return this.dataRightsService.correct(body.userId, body.corrections);
  }

  /**
   * Request account deletion (PDPL Art. 16)
   * 30-day cooling period before actual deletion
   */
  @Delete('my-data')
  async requestDeletion(@Body() body: { userId: string }) {
    this.logger.log(`Data deletion requested by user ${body.userId}`);
    return this.dataRightsService.requestDeletion(body.userId);
  }
}
