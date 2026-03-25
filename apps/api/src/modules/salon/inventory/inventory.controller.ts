import {
  Controller,
  Get,
  Post,
  Patch,
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
import { InventoryService } from './inventory.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductCategoryDto,
} from './dto/create-product.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { LinkServiceProductDto } from './dto/link-service-product.dto';
import { TenantGuard } from '@shared/guards';
import { AuthenticatedRequest } from '@shared/types';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('products')
  @ApiOperation({ summary: 'List products with stock levels' })
  @ApiResponse({ status: 200 })
  async listProducts(@Req() req: AuthenticatedRequest) {
    const data = await this.inventoryService.listProducts(req.tenantDb!);
    return { success: true, data, message: 'Products loaded' };
  }

  @Post('products')
  @ApiOperation({ summary: 'Create product' })
  @ApiResponse({ status: 201 })
  async createProduct(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProductDto,
  ) {
    const data = await this.inventoryService.createProduct(req.tenantDb!, dto);
    return { success: true, data, message: 'Product created' };
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  async updateProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const data = await this.inventoryService.updateProduct(req.tenantDb!, id, dto);
    return { success: true, data, message: 'Product updated' };
  }

  @Get('categories')
  @ApiOperation({ summary: 'List product categories' })
  @ApiResponse({ status: 200 })
  async listCategories(@Req() req: AuthenticatedRequest) {
    const data = await this.inventoryService.listCategories(req.tenantDb!);
    return { success: true, data, message: 'Categories loaded' };
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201 })
  async createCategory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProductCategoryDto,
  ) {
    const data = await this.inventoryService.createCategory(req.tenantDb!, dto);
    return { success: true, data, message: 'Category created' };
  }

  @Post('products/:id/movements')
  @ApiOperation({ summary: 'Record stock movement' })
  @ApiParam({ name: 'id', description: 'Product id' })
  @ApiResponse({ status: 201 })
  async recordMovement(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMovementDto,
  ) {
    await this.inventoryService.recordMovement(req.tenantDb!, id, dto);
    return { success: true, data: null, message: 'Movement recorded' };
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Products below minStock' })
  @ApiResponse({ status: 200 })
  async lowStock(@Req() req: AuthenticatedRequest) {
    const data = await this.inventoryService.listLowStock(req.tenantDb!);
    return { success: true, data, message: 'Low stock products' };
  }

  @Post('services/:serviceId/products')
  @ApiOperation({ summary: 'Link product to service' })
  @ApiParam({ name: 'serviceId' })
  @ApiResponse({ status: 201 })
  async linkToService(
    @Req() req: AuthenticatedRequest,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: LinkServiceProductDto,
  ) {
    const data = await this.inventoryService.linkProductToService(req.tenantDb!, serviceId, dto);
    return { success: true, data, message: 'Linked' };
  }
}
