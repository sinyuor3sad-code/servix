import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { PlatformSettingsService } from '../../shared/database/platform-settings.service';
import { MailService } from '../../shared/mail/mail.service';
import { SubmitComplaintDto } from './dto/submit-complaint.dto';
import { COMPLIANCE_DEFAULTS, COMPLIANCE_KEYS } from './compliance.constants';

export interface PublicLegalInfo {
  merchant: {
    nameAr: string;
    nameEn: string;
    crNumber: string;
    vatNumber: string;
    city: string;
    country: string;
    address: string;
    mapsUrl: string;
  };
  support: {
    email: string;
    phone: string;
    whatsapp: string;
    hours: string;
  };
  complaints: {
    responseTimeAr: string;
    resolutionTimeAr: string;
  };
  legal: {
    termsUrl: string;
    privacyUrl: string;
    refundUrl: string;
  };
  social: {
    x: string;
    instagram: string;
    tiktok: string;
    snapchat: string;
    facebook: string;
    linkedin: string;
  };
  service: {
    deliveryTimeAr: string;
    paymentMethodsAr: string;
  };
}

interface ComplaintContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly platformSettings: PlatformSettingsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Public legal information — name, contacts, support hours, SLAs.
   * Empty strings are returned for unset values; the UI must hide fields
   * when empty rather than display fake data.
   */
  async getPublicLegalInfo(): Promise<PublicLegalInfo> {
    const get = async (key: string) =>
      this.platformSettings.get(key, COMPLIANCE_DEFAULTS[key] ?? '');

    const [
      nameAr, nameEn, crNumber, vatNumber, city, country, address, mapsUrl,
      email, phone, whatsapp, hours,
      responseTimeAr, resolutionTimeAr,
      termsUrl, privacyUrl, refundUrl,
      socialX, socialInstagram, socialTiktok, socialSnapchat, socialFacebook, socialLinkedin,
      deliveryTimeAr, paymentMethodsAr,
    ] = await Promise.all([
      get(COMPLIANCE_KEYS.merchant_name_ar),
      get(COMPLIANCE_KEYS.merchant_name_en),
      get(COMPLIANCE_KEYS.merchant_cr_number),
      get(COMPLIANCE_KEYS.merchant_vat_number),
      get(COMPLIANCE_KEYS.merchant_city),
      get(COMPLIANCE_KEYS.merchant_country),
      get(COMPLIANCE_KEYS.merchant_address),
      get(COMPLIANCE_KEYS.merchant_maps_url),
      get(COMPLIANCE_KEYS.support_email),
      get(COMPLIANCE_KEYS.support_phone),
      get(COMPLIANCE_KEYS.support_whatsapp),
      get(COMPLIANCE_KEYS.support_hours),
      get(COMPLIANCE_KEYS.complaint_response_time_ar),
      get(COMPLIANCE_KEYS.complaint_resolution_time_ar),
      get(COMPLIANCE_KEYS.legal_terms_url),
      get(COMPLIANCE_KEYS.legal_privacy_url),
      get(COMPLIANCE_KEYS.legal_refund_url),
      get(COMPLIANCE_KEYS.social_x),
      get(COMPLIANCE_KEYS.social_instagram),
      get(COMPLIANCE_KEYS.social_tiktok),
      get(COMPLIANCE_KEYS.social_snapchat),
      get(COMPLIANCE_KEYS.social_facebook),
      get(COMPLIANCE_KEYS.social_linkedin),
      get(COMPLIANCE_KEYS.service_delivery_time_ar),
      get(COMPLIANCE_KEYS.payment_methods_ar),
    ]);

    return {
      merchant: { nameAr, nameEn, crNumber, vatNumber, city, country, address, mapsUrl },
      support: { email, phone, whatsapp, hours },
      complaints: { responseTimeAr, resolutionTimeAr },
      legal: { termsUrl, privacyUrl, refundUrl },
      social: {
        x: socialX,
        instagram: socialInstagram,
        tiktok: socialTiktok,
        snapchat: socialSnapchat,
        facebook: socialFacebook,
        linkedin: socialLinkedin,
      },
      service: { deliveryTimeAr, paymentMethodsAr },
    };
  }

  /**
   * Persist a complaint, generate a tamper-resistant reference number, and
   * email the support inbox if SMTP is configured. Returns reference + SLAs
   * so the user sees a meaningful confirmation.
   */
  async submitComplaint(dto: SubmitComplaintDto, ctx: ComplaintContext = {}) {
    const referenceNumber = this.generateReferenceNumber();

    const created = await this.prisma.platformComplaint.create({
      data: {
        referenceNumber,
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        complaintType: dto.complaintType,
        orderOrInvoiceNumber: dto.orderOrInvoiceNumber ?? null,
        message: dto.message,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
      select: { referenceNumber: true, createdAt: true },
    });

    const responseTime = await this.platformSettings.get(
      COMPLIANCE_KEYS.complaint_response_time_ar,
      COMPLIANCE_DEFAULTS[COMPLIANCE_KEYS.complaint_response_time_ar],
    );
    const resolutionTime = await this.platformSettings.get(
      COMPLIANCE_KEYS.complaint_resolution_time_ar,
      COMPLIANCE_DEFAULTS[COMPLIANCE_KEYS.complaint_resolution_time_ar],
    );

    // Best-effort email — failure must NOT lose the complaint, since it's
    // already persisted to the database above.
    void this.notifySupport(referenceNumber, dto).catch((err) => {
      this.logger.warn(
        `Complaint ${referenceNumber} stored but support email failed: ${(err as Error).message}`,
      );
    });

    return {
      referenceNumber: created.referenceNumber,
      createdAt: created.createdAt,
      responseTime,
      resolutionTime,
    };
  }

  private generateReferenceNumber(): string {
    // CMP-YYMMDD-XXXXXX (date prefix + 6 hex chars). Visually short, unique.
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `CMP-${yy}${mm}${dd}-${rand}`;
  }

  private async notifySupport(referenceNumber: string, dto: SubmitComplaintDto) {
    const supportEmail = await this.platformSettings.get(
      COMPLIANCE_KEYS.support_email,
      '',
    );
    if (!supportEmail) {
      this.logger.warn(
        `Complaint ${referenceNumber} stored — no support_email configured, skipping notification`,
      );
      return;
    }

    const lines = [
      `رقم الشكوى: ${referenceNumber}`,
      `الاسم: ${dto.name}`,
      `الجوال: ${dto.phone}`,
      dto.email ? `البريد: ${dto.email}` : null,
      `النوع: ${dto.complaintType}`,
      dto.orderOrInvoiceNumber ? `رقم الطلب/الفاتورة: ${dto.orderOrInvoiceNumber}` : null,
      '',
      'الوصف:',
      dto.message,
    ].filter(Boolean) as string[];

    await this.mailService.send({
      to: supportEmail,
      subject: `[شكوى ${referenceNumber}] ${dto.complaintType}`,
      body: lines.join('\n'),
    });
  }
}
