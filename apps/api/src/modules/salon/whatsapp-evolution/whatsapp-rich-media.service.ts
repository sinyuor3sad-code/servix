import { BadGatewayException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../../../shared/resilience/circuit-breaker.service';

// ─────────────────── Types ───────────────────

export interface SendButtonsArgs {
  instanceName: string;
  instanceToken: string;
  to: string;
  body: string;
  /** Up to 3 button labels (WhatsApp limit). Extra entries are ignored. */
  buttons: string[];
  title?: string;
  footer?: string;
  delayMs?: number;
}

export interface SendListRow {
  rowId: string;
  title: string;
  description?: string;
}

export interface SendListSection {
  title: string;
  rows: SendListRow[];
}

export interface SendListArgs {
  instanceName: string;
  instanceToken: string;
  to: string;
  body: string;
  buttonText: string;
  sections: SendListSection[];
  title?: string;
  footer?: string;
  delayMs?: number;
}

export interface SendImageArgs {
  instanceName: string;
  instanceToken: string;
  to: string;
  imageUrl: string;
  caption?: string;
  delayMs?: number;
}

export interface SendLocationArgs {
  instanceName: string;
  instanceToken: string;
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  delayMs?: number;
}

export interface DownloadMediaArgs {
  instanceName: string;
  instanceToken: string;
  messageKey: { id: string; remoteJid: string; fromMe?: boolean };
}

export interface DownloadedMedia {
  buffer: Buffer;
  mimetype: string;
  filename?: string;
}

const MAX_BUTTONS = 3;
const MAX_LIST_ROWS = 10;

/**
 * Rich Media client for Evolution API — buttons, lists, images, location.
 *
 * Mirrors the HTTP / circuit-breaker pattern used by WhatsAppEvolutionService:
 * same base URL, same `apikey: <instanceToken>` header, JSON body. Each method
 * has its own breaker so a slow image send doesn't trip the buttons path.
 */
@Injectable()
export class WhatsAppRichMediaService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppRichMediaService.name);

  private buttonsBreaker!: CircuitBreaker<[string, Record<string, unknown>, string], void>;
  private listBreaker!: CircuitBreaker<[string, Record<string, unknown>, string], void>;
  private imageBreaker!: CircuitBreaker<[string, Record<string, unknown>, string], void>;
  private locationBreaker!: CircuitBreaker<[string, Record<string, unknown>, string], void>;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  onModuleInit() {
    const post = (url: string, body: Record<string, unknown>, token: string) =>
      this.postJson(url, body, token);

    this.buttonsBreaker = this.circuitBreaker.createBreaker('evolution-send-buttons', post, {
      timeout: 15_000,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 5,
    });
    this.listBreaker = this.circuitBreaker.createBreaker('evolution-send-list', post, {
      timeout: 15_000,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 5,
    });
    this.imageBreaker = this.circuitBreaker.createBreaker('evolution-send-image', post, {
      timeout: 30_000,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 5,
    });
    this.locationBreaker = this.circuitBreaker.createBreaker('evolution-send-location', post, {
      timeout: 15_000,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 5,
    });
  }

  // ═══════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════

  async sendButtons(args: SendButtonsArgs): Promise<void> {
    const buttons = (args.buttons || []).slice(0, MAX_BUTTONS).map((label, idx) => ({
      buttonId: `btn_${idx}`,
      buttonText: { displayText: label },
    }));

    if (!buttons.length) {
      this.logger.warn(`sendButtons called with empty buttons for ${args.to} — skipping`);
      return;
    }

    const url = this.url('sendButtons', args.instanceName);
    const body: Record<string, unknown> = {
      number: this.normalizePhone(args.to),
      title: args.title || '',
      description: args.body,
      buttons,
      delay: args.delayMs ?? 0,
    };
    if (args.footer) body.footer = args.footer;

    await this.buttonsBreaker.fire(url, body, args.instanceToken);
    this.logger.log(`Evolution buttons sent via ${args.instanceName} → ${args.to} (${buttons.length} btns)`);
  }

  async sendList(args: SendListArgs): Promise<void> {
    const sections = (args.sections || [])
      .map((section) => ({
        title: section.title,
        rows: section.rows.slice(0, MAX_LIST_ROWS).map((row) => ({
          rowId: row.rowId,
          title: row.title,
          description: row.description ?? '',
        })),
      }))
      .filter((s) => s.rows.length > 0);

    if (!sections.length) {
      this.logger.warn(`sendList called with empty sections for ${args.to} — skipping`);
      return;
    }

    const url = this.url('sendList', args.instanceName);
    const body: Record<string, unknown> = {
      number: this.normalizePhone(args.to),
      title: args.title || '',
      description: args.body,
      buttonText: args.buttonText,
      sections,
      delay: args.delayMs ?? 0,
    };
    if (args.footer) body.footer = args.footer;

    await this.listBreaker.fire(url, body, args.instanceToken);
    this.logger.log(
      `Evolution list sent via ${args.instanceName} → ${args.to} (${sections.length} sections, ${sections.reduce((n, s) => n + s.rows.length, 0)} rows)`,
    );
  }

  async sendImage(args: SendImageArgs): Promise<void> {
    const url = this.url('sendMedia', args.instanceName);
    const body: Record<string, unknown> = {
      number: this.normalizePhone(args.to),
      mediatype: 'image',
      media: args.imageUrl,
      delay: args.delayMs ?? 0,
    };
    if (args.caption) body.caption = args.caption;

    await this.imageBreaker.fire(url, body, args.instanceToken);
    this.logger.log(`Evolution image sent via ${args.instanceName} → ${args.to}`);
  }

  async sendLocation(args: SendLocationArgs): Promise<void> {
    const url = this.url('sendLocation', args.instanceName);
    const body: Record<string, unknown> = {
      number: this.normalizePhone(args.to),
      latitude: args.latitude,
      longitude: args.longitude,
      delay: args.delayMs ?? 0,
    };
    if (args.name) body.name = args.name;
    if (args.address) body.address = args.address;

    await this.locationBreaker.fire(url, body, args.instanceToken);
    this.logger.log(`Evolution location sent via ${args.instanceName} → ${args.to}`);
  }

  /**
   * Download an inbound media message (audio/image/etc) as a Buffer using
   * Evolution's `getBase64FromMediaMessage` endpoint. Returns null if the
   * download fails — caller decides how to recover.
   */
  async downloadMediaAsBuffer(args: DownloadMediaArgs): Promise<DownloadedMedia | null> {
    const url = `${this.baseUrl()}/chat/getBase64FromMediaMessage/${encodeURIComponent(args.instanceName)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { apikey: args.instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { key: args.messageKey } }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `Media download failed ${res.status} for ${args.instanceName}/${args.messageKey.id}: ${text.slice(0, 150)}`,
        );
        return null;
      }
      const data = (await res.json()) as { base64?: string; mimetype?: string; fileName?: string };
      if (!data.base64) return null;
      return {
        buffer: Buffer.from(data.base64, 'base64'),
        mimetype: data.mimetype || 'application/octet-stream',
        filename: data.fileName,
      };
    } catch (err) {
      this.logger.error(`Media download error for ${args.instanceName}/${args.messageKey.id}: ${(err as Error).message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // Internals (mirrors WhatsAppEvolutionService helpers)
  // ═══════════════════════════════════════════

  private url(endpoint: 'sendButtons' | 'sendList' | 'sendMedia' | 'sendLocation', instanceName: string): string {
    return `${this.baseUrl()}/message/${endpoint}/${encodeURIComponent(instanceName)}`;
  }

  private baseUrl(): string {
    const url = this.configService.get<string>('EVOLUTION_API_URL', 'http://evolution-api:8080');
    return url.replace(/\/+$/, '');
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return digits;
    if (digits.startsWith('0')) return '966' + digits.slice(1);
    return '966' + digits;
  }

  private async postJson(url: string, body: Record<string, unknown>, token: string): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(`Evolution rich media failed ${res.status}: ${text || res.statusText}`);
    }
  }
}
