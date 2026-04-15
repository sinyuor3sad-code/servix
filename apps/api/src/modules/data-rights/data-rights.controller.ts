import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DataRightsService } from './data-rights.service';
import { AuthenticatedRequest } from '../../shared/types';

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
  async exportMyData(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const tenantDb = req.tenantDb;
    this.logger.log(`Data export requested by user ${userId}`);
    return this.dataRightsService.exportAll(userId, tenantDb ?? null);
  }

  /**
   * Correct personal data (PDPL Art. 15)
   */
  @Patch('my-data')
  async correctMyData(
    @Req() req: AuthenticatedRequest,
    @Body() body: { corrections: Record<string, any> },
  ) {
    const userId = req.user.sub;
    const tenantDb = req.tenantDb;
    if (!body.corrections || Object.keys(body.corrections).length === 0) {
      throw new BadRequestException('لا توجد تعديلات مطلوبة');
    }
    this.logger.log(`Data correction requested by user ${userId}`);
    return this.dataRightsService.correct(userId, body.corrections, tenantDb ?? null);
  }

  /**
   * Request account deletion (PDPL Art. 16)
   * 30-day cooling period before actual deletion
   */
  @Delete('my-data')
  async requestDeletion(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const tenantDb = req.tenantDb;
    this.logger.log(`Data deletion requested by user ${userId}`);
    return this.dataRightsService.requestDeletion(userId, tenantDb ?? null);
  }

  /**
   * Cancel a pending deletion request
   */
  @Patch('my-data/cancel-deletion')
  async cancelDeletion(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const tenantDb = req.tenantDb;
    this.logger.log(`Deletion cancellation requested by user ${userId}`);
    return this.dataRightsService.cancelDeletion(userId, tenantDb ?? null);
  }
}
