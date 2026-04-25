import { Injectable } from '@nestjs/common';
import type { TenantPrismaClient } from '../../../shared/types';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_DEFAULTS, SETTINGS_KEYS } from '../settings/settings.constants';

export type AIReceptionTone = 'formal' | 'friendly' | 'light_gulf' | 'luxury';
export type AIReceptionBookingConfirmationMode = 'manual' | 'auto_if_available';

export interface AIReceptionRuntimeSettings {
  aiReceptionEnabled: boolean;
  aiManagerPhone: string;
  tone: AIReceptionTone;
  welcomeMessage: string;
  managerApprovalTimeoutMinutes: number;
  maxUnderstandingFailures: number;
  escalationCooldownMinutes: number;
  bookingConfirmationMode: AIReceptionBookingConfirmationMode;
  privacyMessageEnabled: boolean;
  privacyMessage: string;
  avoidedPhrases: string[];
  customEscalationKeywords: string[];
  showEmployeeNamesToCustomers: boolean;
  availableSlotsLimit: number;
  systemPromptOverride?: string;
}

@Injectable()
export class AIReceptionSettingsService {
  constructor(private readonly settings: SettingsService) {}

  async get(
    tenantDb: TenantPrismaClient,
    tenantId?: string,
  ): Promise<AIReceptionRuntimeSettings> {
    const raw = await this.settings.getAll(tenantDb, tenantId);
    return this.fromRecord(raw);
  }

  fromRecord(raw: Record<string, string>): AIReceptionRuntimeSettings {
    const value = (key: string) => raw[key] ?? SETTINGS_DEFAULTS[key] ?? '';
    return {
      aiReceptionEnabled: this.parseBool(value(SETTINGS_KEYS.ai_reception_enabled), true),
      aiManagerPhone: value(SETTINGS_KEYS.ai_manager_phone).trim(),
      tone: this.parseTone(value(SETTINGS_KEYS.ai_tone)),
      welcomeMessage: value(SETTINGS_KEYS.ai_welcome_message) || SETTINGS_DEFAULTS[SETTINGS_KEYS.ai_welcome_message],
      managerApprovalTimeoutMinutes: this.parseIntRange(value(SETTINGS_KEYS.ai_approval_timeout_minutes), 1, 120, 15),
      maxUnderstandingFailures: this.parseIntRange(value(SETTINGS_KEYS.ai_max_understanding_failures), 1, 5, 2),
      escalationCooldownMinutes: this.parseIntRange(value(SETTINGS_KEYS.ai_escalation_cooldown_minutes), 1, 120, 10),
      bookingConfirmationMode: this.parseConfirmationMode(value(SETTINGS_KEYS.ai_booking_confirmation_mode)),
      privacyMessageEnabled: this.parseBool(value(SETTINGS_KEYS.ai_privacy_message_enabled), false),
      privacyMessage: value(SETTINGS_KEYS.ai_privacy_message) || SETTINGS_DEFAULTS[SETTINGS_KEYS.ai_privacy_message],
      avoidedPhrases: this.parseList(value(SETTINGS_KEYS.ai_avoided_phrases)),
      customEscalationKeywords: this.parseList(value(SETTINGS_KEYS.ai_custom_escalation_keywords)),
      showEmployeeNamesToCustomers: this.parseBool(value(SETTINGS_KEYS.ai_show_employee_names_to_customers), false),
      availableSlotsLimit: this.parseIntRange(value(SETTINGS_KEYS.ai_available_slots_limit), 1, 5, 3),
      systemPromptOverride: raw.ai_system_prompt_override?.trim() || undefined,
    };
  }

  private parseBool(value: string, fallback: boolean): boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  private parseTone(value: string): AIReceptionTone {
    return ['formal', 'friendly', 'light_gulf', 'luxury'].includes(value)
      ? value as AIReceptionTone
      : 'light_gulf';
  }

  private parseConfirmationMode(value: string): AIReceptionBookingConfirmationMode {
    return value === 'auto_if_available' ? 'auto_if_available' : 'manual';
  }

  private parseIntRange(value: string, min: number, max: number, fallback: number): number {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      return fallback;
    }
    return parsed;
  }

  private parseList(value: string): string[] {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 50);
      }
    } catch {
      // Fall through to newline/comma parsing.
    }

    return value
      .split(/[\n,،]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
}
