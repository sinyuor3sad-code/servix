import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UploadsService, UploadResult } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'رفع صورة' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'تم رفع الصورة بنجاح' })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    return this.uploadsService.uploadImage(file);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'رفع شعار' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'تم رفع الشعار بنجاح' })
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    return this.uploadsService.uploadLogo(file);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'حذف ملف' })
  @ApiResponse({ status: 200, description: 'تم حذف الملف بنجاح' })
  async deleteFile(@Param('key') key: string): Promise<{ message: string }> {
    await this.uploadsService.deleteFile(key);
    return { message: 'تم حذف الملف بنجاح' };
  }
}
