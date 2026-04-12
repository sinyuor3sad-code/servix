import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantGuard } from '../../shared/guards';
import { AuthenticatedRequest } from '../../shared/types';
import { SettingsService } from '../../modules/salon/settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

class WhatsAppConnectDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  phoneNumberId: string;

  @IsString()
  @IsOptional()
  wabaId?: string;
}

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller({ path: 'salon/whatsapp', version: '1' })
export class WhatsAppConnectController {
  private readonly logger = new Logger(WhatsAppConnectController.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('connect')
  @ApiOperation({ summary: 'ربط واتساب عبر Embedded Signup' })
  async connect(
    @Req() req: AuthenticatedRequest,
    @Body() dto: WhatsAppConnectDto,
  ) {
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');

    if (!appId || !appSecret) {
      throw new BadRequestException('Meta App credentials not configured');
    }

    try {
      // Step 1: Exchange the code for a short-lived user token
      const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${dto.code}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json() as any;

      if (tokenData.error) {
        this.logger.error(`Token exchange failed: ${JSON.stringify(tokenData.error)}`);
        throw new BadRequestException(
          `فشل ربط الواتساب: ${tokenData.error.message || 'Token exchange failed'}`,
        );
      }

      const accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new BadRequestException('لم يتم الحصول على رمز الوصول من فيسبوك');
      }

      // Step 2: Register the phone number for Cloud API
      try {
        const registerUrl = `https://graph.facebook.com/v21.0/${dto.phoneNumberId}/register`;
        const registerRes = await fetch(registerUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: '123456',
          }),
        });
        const registerData = await registerRes.json() as any;
        this.logger.log(`Phone registration result: ${JSON.stringify(registerData)}`);
      } catch (err) {
        this.logger.warn(`Phone registration skipped: ${(err as Error).message}`);
        // Non-fatal — phone may already be registered
      }

      // Step 3: Subscribe app to WABA webhooks (if wabaId provided)
      if (dto.wabaId) {
        try {
          const subUrl = `https://graph.facebook.com/v21.0/${dto.wabaId}/subscribed_apps`;
          const subRes = await fetch(subUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
          const subData = await subRes.json() as any;
          this.logger.log(`Webhook subscription result: ${JSON.stringify(subData)}`);
        } catch (err) {
          this.logger.warn(`Webhook subscription skipped: ${(err as Error).message}`);
        }
      }

      // Step 4: Get phone number display info
      let displayPhone = dto.phoneNumberId;
      try {
        const phoneInfoUrl = `https://graph.facebook.com/v21.0/${dto.phoneNumberId}?access_token=${accessToken}`;
        const phoneRes = await fetch(phoneInfoUrl);
        const phoneData = await phoneRes.json() as any;
        if (phoneData.display_phone_number) {
          displayPhone = phoneData.display_phone_number;
        }
      } catch {
        // Non-fatal
      }

      // Step 5: Save all credentials to tenant settings
      const db = req.tenantDb!;
      const userId = req.user.sub;
      const tenantId = req.tenant?.id;

      await this.settingsService.updateBatch(db, {
        settings: [
          { key: 'whatsapp_phone_number_id', value: dto.phoneNumberId },
          { key: 'whatsapp_access_token', value: accessToken },
          { key: 'whatsapp_waba_id', value: dto.wabaId || '' },
          { key: 'whatsapp_display_phone', value: displayPhone },
          { key: 'whatsapp_bot_enabled', value: 'true' },
          { key: 'whatsapp_connected_at', value: new Date().toISOString() },
        ],
      }, userId, tenantId);

      this.logger.log(`✅ WhatsApp connected for tenant ${tenantId} — phone: ${displayPhone}`);

      return {
        success: true,
        displayPhone,
        phoneNumberId: dto.phoneNumberId,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`WhatsApp connect error: ${(err as Error).message}`, (err as Error).stack);
      throw new BadRequestException(`فشل ربط الواتساب: ${(err as Error).message}`);
    }
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'فصل واتساب' })
  async disconnect(@Req() req: AuthenticatedRequest) {
    const db = req.tenantDb!;
    const userId = req.user.sub;
    const tenantId = req.tenant?.id;

    await this.settingsService.updateBatch(db, {
      settings: [
        { key: 'whatsapp_phone_number_id', value: '' },
        { key: 'whatsapp_access_token', value: '' },
        { key: 'whatsapp_waba_id', value: '' },
        { key: 'whatsapp_display_phone', value: '' },
        { key: 'whatsapp_bot_enabled', value: 'false' },
        { key: 'whatsapp_connected_at', value: '' },
      ],
    }, userId, tenantId);

    this.logger.log(`❌ WhatsApp disconnected for tenant ${tenantId}`);
    return { success: true };
  }
}
