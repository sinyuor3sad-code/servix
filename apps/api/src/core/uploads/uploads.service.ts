import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/** SEC-5: Only JPEG, PNG, WebP — no GIF, SVG, etc. */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Detect MIME from magic bytes (don't trust client Content-Type) */
function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
  return null;
}

@Injectable()
export class UploadsService {
  constructor() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
    this.validateFile(file, 5 * 1024 * 1024);

    const key = `images/${uuidv4()}.webp`;
    const outputPath = path.join(UPLOAD_DIR, key);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const result = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return {
      url: `/uploads/${key}`,
      key,
      size: result.size,
    };
  }

  async uploadLogo(file: Express.Multer.File): Promise<UploadResult> {
    this.validateFile(file, 2 * 1024 * 1024);

    const key = `logos/${uuidv4()}.webp`;
    const outputPath = path.join(UPLOAD_DIR, key);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const result = await sharp(file.buffer)
      .rotate()
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return {
      url: `/uploads/${key}`,
      key,
      size: result.size,
    };
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private validateFile(file: Express.Multer.File, maxSize: number): void {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('الملف فارغ أو غير صالح');
    }
    const detectedMime = detectMimeFromBuffer(file.buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      throw new BadRequestException('نوع الملف غير مدعوم. الأنواع المسموحة: JPEG, PNG, WebP فقط');
    }
    if (file.size > maxSize) {
      const maxMb = Math.floor(maxSize / (1024 * 1024));
      throw new BadRequestException(`حجم الملف يتجاوز الحد الأقصى (${maxMb} ميجابايت)`);
    }
  }
}
