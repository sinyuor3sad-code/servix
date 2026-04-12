import { Injectable, Logger } from '@nestjs/common';

export interface WhatsAppCredentials {
  token: string;
  phoneNumberId: string;
}

export interface SendWhatsAppOptions {
  to: string;
  message: string;
  templateName?: string;
  templateParams?: string[];
}

export interface SendWhatsAppDocumentOptions {
  to: string;
  document: Buffer;
  filename: string;
  caption?: string;
}

const GRAPH_API_VERSION = 'v21.0';

@Injectable()
export class WhatsAppService {
  private logger = new Logger(WhatsAppService.name);

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return digits;
    if (digits.startsWith('0')) return '966' + digits.slice(1);
    return '966' + digits;
  }

  async send(options: SendWhatsAppOptions, credentials: WhatsAppCredentials | null): Promise<void> {
    if (!credentials?.token || !credentials?.phoneNumberId) {
      this.logger.warn('WhatsApp not configured for this tenant');
      return;
    }

    const to = this.normalizePhone(options.to);
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: options.message },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`WhatsApp send failed: ${res.status} ${err}`);
      throw new Error(`WhatsApp send failed: ${res.status}`);
    }
    this.logger.log(`WhatsApp sent to ${to}`);
  }

  async sendDocument(options: SendWhatsAppDocumentOptions, credentials: WhatsAppCredentials | null): Promise<void> {
    if (!credentials?.token || !credentials?.phoneNumberId) {
      this.logger.warn('WhatsApp not configured for this tenant');
      return;
    }

    const to = this.normalizePhone(options.to);

    const mediaFormData = new FormData();
    const blob = new Blob([new Uint8Array(options.document)], { type: 'application/pdf' });
    mediaFormData.append('file', blob, options.filename);
    mediaFormData.append('type', 'application/pdf');

    const uploadUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/media`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credentials.token}` },
      body: mediaFormData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      this.logger.error(`WhatsApp media upload failed: ${uploadRes.status} ${err}`);
      throw new Error(`WhatsApp media upload failed: ${uploadRes.status}`);
    }

    const { id: mediaId } = (await uploadRes.json()) as { id: string };
    if (!mediaId) {
      throw new Error('WhatsApp media upload returned no ID');
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: {
        id: mediaId,
        caption: options.caption ? options.caption.substring(0, 1024) : undefined,
        filename: options.filename,
      },
    };

    const msgUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/messages`;
    const res = await fetch(msgUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`WhatsApp document send failed: ${res.status} ${err}`);
      throw new Error(`WhatsApp document send failed: ${res.status}`);
    }
    this.logger.log(`WhatsApp document sent to ${to}`);
  }
}
