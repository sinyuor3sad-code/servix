import {
  Injectable,
  Logger,
  OnModuleInit,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import { randomBytes } from 'crypto';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { CircuitBreakerService } from '../../../shared/resilience/circuit-breaker.service';
import type { WhatsAppInstance, WhatsAppInstanceStatus } from '../../../../generated/platform';
import { EVOLUTION_WEBHOOK_FULL_PATH } from './webhook-path.constant';

export interface EvolutionInstanceDetails {
  status: WhatsAppInstanceStatus;
  instanceName: string;
  phoneNumber: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  qrCode: string | null;
}

export interface SendTextArgs {
  instanceName: string;
  instanceToken: string;
  to: string;
  message: string;
  delayMs?: number;
}

export interface SendMediaArgs extends SendTextArgs {
  mediaUrl: string;
  mediaType: 'image' | 'document' | 'audio' | 'video';
  filename?: string;
  caption?: string;
  mimetype?: string;
}

@Injectable()
export class WhatsAppEvolutionService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppEvolutionService.name);

  private sendTextBreaker!: CircuitBreaker<[string, Record<string, unknown>, string], void>;
  private sendMediaBreaker!: CircuitBreaker<[string, Record<string, unknown>, string], void>;
  private adminBreaker!: CircuitBreaker<[RequestInit & { url: string }], unknown>;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  onModuleInit() {
    this.sendTextBreaker = this.circuitBreaker.createBreaker(
      'evolution-send-text',
      (url: string, body: Record<string, unknown>, token: string) =>
        this.postJson(url, body, token),
      { timeout: 15_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
    this.sendMediaBreaker = this.circuitBreaker.createBreaker(
      'evolution-send-media',
      (url: string, body: Record<string, unknown>, token: string) =>
        this.postJson(url, body, token),
      { timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
    this.adminBreaker = this.circuitBreaker.createBreaker(
      'evolution-admin',
      (req: RequestInit & { url: string }) => this.rawFetch(req),
      { timeout: 15_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
  }

  // ───────── Public API ─────────

  async getOrCreateInstance(tenantId: string, tenantSlug: string): Promise<WhatsAppInstance> {
    const existing = await this.platformPrisma.whatsAppInstance.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    const baseName = `salon-${tenantSlug.toLowerCase()}`;

    // If Evolution still has an instance under the canonical name (e.g. platform
    // record was wiped while Evolution kept its row), adopt it back instead of
    // creating a new one. Keeps phone/profile metadata intact.
    const orphanedEvolutionInstance = await this.fetchRawInstance(baseName);
    if (orphanedEvolutionInstance) {
      this.logger.warn(
        `Recovering platform WhatsApp record from existing Evolution instance: ${baseName}`,
      );
      return this.upsertPlatformInstanceFromEvolution(
        tenantId,
        baseName,
        orphanedEvolutionInstance,
        randomBytes(24).toString('hex'),
      );
    }

    // Fresh create. Evolution v2.x can refuse a name as "already in use" because
    // of stale Redis/in-memory cache even when Postgres + fetchInstances both
    // show no row. Retry with a random suffix so the user is never blocked by
    // upstream cache state we cannot clear from here.
    return this.createFreshInstance(tenantId, baseName);
  }

  private async createFreshInstance(
    tenantId: string,
    baseName: string,
  ): Promise<WhatsAppInstance> {
    const MAX_ATTEMPTS = 4;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const instanceName =
        attempt === 0 ? baseName : `${baseName}-${randomBytes(3).toString('hex')}`;
      const instanceToken = randomBytes(24).toString('hex');

      try {
        await this.createOnEvolution(instanceName, instanceToken);
        this.logger.log(
          `Evolution instance created: ${instanceName} (tenant=${tenantId}, attempt=${attempt + 1})`,
        );
        return this.platformPrisma.whatsAppInstance.create({
          data: { tenantId, instanceName, instanceToken, status: 'qr_pending' },
        });
      } catch (err) {
        lastError = err;

        if (this.isNameTakenError(err)) {
          this.logger.warn(
            `Evolution rejected "${instanceName}" as already in use (likely stale cache); retrying with suffix`,
          );
          continue;
        }

        // Non-conflict error: try recovery if Evolution actually does have the
        // row now (race), otherwise propagate.
        const recovered = await this.fetchRawInstance(instanceName);
        if (recovered) {
          this.logger.warn(
            `Evolution create failed, recovered existing instance instead: ${instanceName}`,
          );
          return this.upsertPlatformInstanceFromEvolution(
            tenantId,
            instanceName,
            recovered,
            instanceToken,
          );
        }
        throw err;
      }
    }

    throw lastError ?? new BadGatewayException('Evolution refused all instance name candidates');
  }

  private async createOnEvolution(instanceName: string, instanceToken: string): Promise<void> {
    const apiBaseUrl = this.configService.get<string>(
      'API_BASE_URL',
      'https://api.servi-x.com',
    );
    const webhookUrl = `${apiBaseUrl}${EVOLUTION_WEBHOOK_FULL_PATH}/${instanceName}`;
    await this.adminRequest('POST', '/instance/create', {
      instanceName,
      token: instanceToken,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        headers: { apikey: this.configService.get<string>('EVOLUTION_API_KEY', '') },
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      },
    });
  }

  async fetchInstanceDetails(instanceName: string): Promise<EvolutionInstanceDetails> {
    const list = await this.adminRequest<Array<Record<string, unknown>>>(
      'GET',
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    );

    const record = Array.isArray(list) ? list[0] : null;
    if (!record) throw new NotFoundException('Evolution instance not found');

    const connectionStatus = String(record['connectionStatus'] ?? record['status'] ?? 'close');
    const ownerJid = record['ownerJid'] as string | null | undefined;
    const profileName = (record['profileName'] as string) || null;
    const profilePicUrl = (record['profilePicUrl'] as string) || null;

    return {
      status: this.mapConnectionStatus(connectionStatus),
      instanceName,
      phoneNumber: ownerJid ? ownerJid.split('@')[0] : null,
      profileName,
      profilePicUrl,
      qrCode: null,
    };
  }

  async fetchQrCode(instanceName: string): Promise<string | null> {
    try {
      // Evolution's /instance/connect endpoint both initiates connection
      // AND returns a QR code if the instance is not yet connected.
      const data = await this.adminRequest<Record<string, unknown>>(
        'GET',
        `/instance/connect/${encodeURIComponent(instanceName)}`,
      );
      // Evolution v2 returns { base64: "data:image/png;base64,..." }
      // or { code: "raw-qr-string" } or { pairingCode: "..." }
      const base64 = data['base64'] as string | undefined;
      const code = data['code'] as string | undefined;
      const pairingCode = data['pairingCode'] as string | undefined;
      const result = base64 || code || pairingCode || null;
      if (result) {
        this.logger.log(`QR code fetched for ${instanceName} (length=${result.length})`);
      } else {
        this.logger.warn(`QR fetch returned empty for ${instanceName}: ${JSON.stringify(data).slice(0, 200)}`);
      }
      return result;
    } catch (err) {
      this.logger.warn(`QR fetch failed for ${instanceName}: ${(err as Error).message}`);
      return null;
    }
  }

  async logoutInstance(instanceName: string): Promise<boolean> {
    try {
      await this.adminRequest('DELETE', `/instance/logout/${encodeURIComponent(instanceName)}`);
      return true;
    } catch (err) {
      this.logger.warn(`Logout failed for ${instanceName}: ${(err as Error).message}`);
      return this.isNotFoundError(err);
    }
  }

  async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      await this.adminRequest('DELETE', `/instance/delete/${encodeURIComponent(instanceName)}`);
      return true;
    } catch (err) {
      this.logger.warn(`Delete failed for ${instanceName}: ${(err as Error).message}`);
      return this.isNotFoundError(err);
    }
  }

  async sendText(args: SendTextArgs): Promise<void> {
    const url = `${this.baseUrl()}/message/sendText/${encodeURIComponent(args.instanceName)}`;
    const body = {
      number: this.normalizePhone(args.to),
      text: args.message,
      delay: args.delayMs ?? 0,
    };
    await this.sendTextBreaker.fire(url, body, args.instanceToken);
    this.logger.log(`Evolution text sent via ${args.instanceName} → ${args.to}`);
  }

  async sendMedia(args: SendMediaArgs): Promise<void> {
    const url = `${this.baseUrl()}/message/sendMedia/${encodeURIComponent(args.instanceName)}`;
    const body: Record<string, unknown> = {
      number: this.normalizePhone(args.to),
      mediatype: args.mediaType,
      media: args.mediaUrl,
      delay: args.delayMs ?? 0,
    };
    if (args.filename) body.fileName = args.filename;
    if (args.caption) body.caption = args.caption;
    if (args.mimetype) body.mimetype = args.mimetype;
    await this.sendMediaBreaker.fire(url, body, args.instanceToken);
    this.logger.log(`Evolution media sent via ${args.instanceName} → ${args.to}`);
  }

  async syncInstanceStatus(instanceName: string): Promise<WhatsAppInstance | null> {
    const record = await this.platformPrisma.whatsAppInstance.findUnique({
      where: { instanceName },
    });
    if (!record) return null;

    const details = await this.fetchInstanceDetails(instanceName);
    const now = new Date();
    return this.platformPrisma.whatsAppInstance.update({
      where: { instanceName },
      data: {
        status: details.status,
        phoneNumber: details.phoneNumber,
        profileName: details.profileName,
        profilePicUrl: details.profilePicUrl,
        lastConnectedAt: details.status === 'connected' ? now : record.lastConnectedAt,
        lastDisconnectedAt:
          details.status === 'disconnected' && record.status === 'connected'
            ? now
            : record.lastDisconnectedAt,
      },
    });
  }

  // ───────── Helpers ─────────

  private async fetchRawInstance(instanceName: string): Promise<Record<string, unknown> | null> {
    try {
      const list = await this.adminRequest<Array<Record<string, unknown>>>(
        'GET',
        `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
      );
      if (!Array.isArray(list)) return null;
      return list.find((record) => String(record['name'] ?? record['instanceName']) === instanceName) ?? null;
    } catch (err) {
      if (this.isNotFoundError(err)) return null;
      throw err;
    }
  }

  private async upsertPlatformInstanceFromEvolution(
    tenantId: string,
    instanceName: string,
    record: Record<string, unknown>,
    fallbackToken: string,
  ): Promise<WhatsAppInstance> {
    const connectionStatus = String(record['connectionStatus'] ?? record['status'] ?? 'close');
    const status = this.mapConnectionStatus(connectionStatus);
    const ownerJid = record['ownerJid'] as string | null | undefined;
    const profileName = (record['profileName'] as string) || null;
    const profilePicUrl = (record['profilePicUrl'] as string) || null;
    const token = (record['token'] as string | null | undefined) || fallbackToken;
    const now = new Date();

    return this.platformPrisma.whatsAppInstance.upsert({
      where: { tenantId },
      create: {
        tenantId,
        instanceName,
        instanceToken: token,
        status,
        phoneNumber: ownerJid ? ownerJid.split('@')[0] : null,
        profileName,
        profilePicUrl,
        qrCode: null,
        lastConnectedAt: status === 'connected' ? now : null,
        lastDisconnectedAt: status === 'disconnected' ? now : null,
      },
      update: {
        instanceName,
        instanceToken: token,
        status,
        phoneNumber: ownerJid ? ownerJid.split('@')[0] : null,
        profileName,
        profilePicUrl,
        qrCode: null,
        lastConnectedAt: status === 'connected' ? now : undefined,
        lastDisconnectedAt: status === 'disconnected' ? now : undefined,
      },
    });
  }

  private isNameTakenError(err: unknown): boolean {
    const message = (err as Error)?.message?.toLowerCase() ?? '';
    return (
      message.includes('evolution api 403') &&
      (message.includes('already in use') || message.includes('in use'))
    );
  }

  private isNotFoundError(err: unknown): boolean {
    const message = (err as Error)?.message?.toLowerCase() ?? '';
    if (message.includes('evolution api 404') || message.includes('not found')) {
      return true;
    }
    // Evolution v2.x: when Baileys session is desynced from DB state, logout
    // returns 500 "Connection Closed" and a follow-up delete returns 400 with
    // an opaque "[object Object]" payload. The instance is unusable in both
    // cases — treat as cleanable so disconnect/reconnect don't deadlock.
    if (message.includes('connection closed')) return true;
    if (message.includes('evolution api 400')) return true;
    return false;
  }

  private mapConnectionStatus(raw: string): WhatsAppInstanceStatus {
    const s = raw.toLowerCase();
    if (s === 'open' || s === 'connected') return 'connected';
    if (s === 'connecting') return 'connecting';
    if (s === 'close' || s === 'closed' || s === 'disconnected') return 'disconnected';
    return 'error';
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return digits;
    if (digits.startsWith('0')) return '966' + digits.slice(1);
    return '966' + digits;
  }

  private baseUrl(): string {
    const url = this.configService.get<string>('EVOLUTION_API_URL', 'http://evolution-api:8080');
    return url.replace(/\/+$/, '');
  }

  private masterKey(): string {
    const key = this.configService.get<string>('EVOLUTION_API_KEY');
    if (!key) throw new BadGatewayException('EVOLUTION_API_KEY is not configured');
    return key;
  }

  private async adminRequest<T>(
    method: 'GET' | 'POST' | 'DELETE' | 'PUT',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        apikey: this.masterKey(),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    };
    return (await this.adminBreaker.fire({ ...init, url })) as T;
  }

  private async rawFetch(req: RequestInit & { url: string }): Promise<unknown> {
    const { url, ...init } = req;
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(`Evolution API ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null;
    const type = res.headers.get('content-type') || '';
    if (type.includes('application/json')) return res.json();
    return res.text();
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
      throw new BadGatewayException(`Evolution send failed ${res.status}: ${text || res.statusText}`);
    }
  }
}
