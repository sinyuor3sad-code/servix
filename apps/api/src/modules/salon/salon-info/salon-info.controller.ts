import { Controller, Get, Put, Post, Body, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { TenantGuard } from '../../../shared/guards';
import { SalonInfoService } from './salon-info.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import { AuthenticatedRequest } from '../../../shared/types';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'logos');
const COVER_DIR = join(process.cwd(), 'uploads', 'covers');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
if (!existsSync(COVER_DIR)) mkdirSync(COVER_DIR, { recursive: true });

@ApiTags('Salon Info')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon', version: '1' })
export class SalonInfoController {
  constructor(private readonly salonInfoService: SalonInfoService) {}

  @Get()
  @ApiOperation({ summary: 'الحصول على معلومات الصالون' })
  @ApiResponse({ status: 200, description: 'تم جلب معلومات الصالون بنجاح' })
  async get(
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    return this.salonInfoService.get(req.tenantDb!);
  }

  @Put()
  @ApiOperation({ summary: 'تحديث معلومات الصالون' })
  @ApiResponse({ status: 200, description: 'تم تحديث معلومات الصالون بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSalonDto,
  ): Promise<Record<string, unknown>> {
    return this.salonInfoService.update(
      req.tenantDb!,
      dto,
    );
  }

  @Get('branding')
  @ApiOperation({ summary: 'الحصول على إعدادات الهوية البصرية' })
  @ApiResponse({ status: 200, description: 'تم جلب إعدادات الهوية البصرية بنجاح' })
  async getBranding(
    @Req() req: AuthenticatedRequest,
  ) {
    const info = await this.salonInfoService.get(req.tenantDb!);
    return (info as any).branding ?? { theme: 'velvet', primaryColor: '#8B5CF6', logoUrl: null, mode: 'light' };
  }

  @Put('branding')
  @ApiOperation({ summary: 'تحديث الهوية البصرية' })
  @ApiResponse({ status: 200, description: 'تم تحديث الهوية البصرية بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async updateBranding(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.salonInfoService.updateBranding(
      req.tenantDb!,
      dto,
    );
  }

  @Put('working-hours')
  @ApiOperation({ summary: 'تحديث ساعات العمل' })
  @ApiResponse({ status: 200, description: 'تم تحديث ساعات العمل بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async updateWorkingHours(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateWorkingHoursDto,
  ) {
    return this.salonInfoService.updateWorkingHours(
      req.tenantDb!,
      dto,
    );
  }

  @Post('logo')
  @ApiOperation({ summary: 'رفع شعار الصالون' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'تم رفع الشعار بنجاح' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, `logo-${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(png|jpe?g|webp)$/)) {
        cb(new BadRequestException('فقط PNG, JPG, WebP'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async uploadLogo(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('الرجاء رفع ملف');
    const apiBase = process.env.API_URL || 'https://api.servi-x.com';
    const logoUrl = `${apiBase}/uploads/logos/${file.filename}`;

    await this.salonInfoService.updateBranding(req.tenantDb!, { logoUrl });

    return { logoUrl, message: 'تم رفع الشعار بنجاح ✅' };
  }

  @Put('theme')
  @ApiOperation({ summary: 'تحديث إعدادات ثيم المنيو الذكي' })
  @ApiResponse({ status: 200, description: 'تم تحديث الثيم بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async updateTheme(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateThemeDto,
  ) {
    return this.salonInfoService.updateTheme(
      req.tenantDb!,
      dto,
    );
  }

  @Post('cover')
  @ApiOperation({ summary: 'رفع صورة غلاف الصالون' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'تم رفع صورة الغلاف بنجاح' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: COVER_DIR,
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, `cover-${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(png|jpe?g|webp)$/)) {
        cb(new BadRequestException('فقط PNG, JPG, WebP'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async uploadCover(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('الرجاء رفع ملف');
    const apiBase = process.env.API_URL || 'https://api.servi-x.com';
    const coverImageUrl = `${apiBase}/uploads/covers/${file.filename}`;

    await this.salonInfoService.updateTheme(req.tenantDb!, { coverImageUrl });

    return { coverImageUrl, message: 'تم رفع صورة الغلاف بنجاح ✅' };
  }
}
