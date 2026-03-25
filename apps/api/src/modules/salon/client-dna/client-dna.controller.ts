import { Controller, Get, Param, Req, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ClientDnaService } from './client-dna.service';
import { TenantGuard } from '@shared/guards';
import { AuthenticatedRequest } from '@shared/types';

@ApiTags('Client DNA')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'clients', version: '1' })
export class ClientDnaController {
  constructor(private readonly clientDnaService: ClientDnaService) {}

  @Get(':id/dna')
  @ApiOperation({ summary: 'Client profile with DNA metrics' })
  @ApiParam({ name: 'id', description: 'Client id' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getDna(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.clientDnaService.getProfile(req.tenantDb!, id);
    return { success: true, data, message: 'Client DNA profile' };
  }
}
