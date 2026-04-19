import { Controller, Get, Post, Param, Req, ParseUUIDPipe, UseGuards } from '@nestjs/common';
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

  @Post(':id/dna/compute')
  @ApiOperation({ summary: 'Compute DNA metrics for a single client' })
  @ApiParam({ name: 'id', description: 'Client id' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404 })
  async computeOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.clientDnaService.computeForClient(req.tenantDb!, id);
    return { success: true, message: 'Client DNA computed' };
  }

  @Post('dna/compute-all')
  @ApiOperation({ summary: 'Compute DNA metrics for all clients' })
  @ApiResponse({ status: 201 })
  async computeAll(
    @Req() req: AuthenticatedRequest,
  ) {
    const processed = await this.clientDnaService.computeForAllClients(req.tenantDb!);
    return { success: true, data: { processed }, message: 'All clients DNA computed' };
  }
}
