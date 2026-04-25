import { AIReceptionSettingsService } from './ai-reception-settings.service';
import type { SettingsService } from '../settings/settings.service';
import { validateSetting } from '../settings/settings.schema';

describe('AIReceptionSettingsService', () => {
  function makeService(raw: Record<string, string>) {
    const settings = {
      getAll: jest.fn().mockResolvedValue(raw),
    } as unknown as SettingsService;
    return {
      service: new AIReceptionSettingsService(settings),
      settings,
    };
  }

  it('uses safe defaults when settings are missing', async () => {
    const { service } = makeService({});

    const result = await service.get({} as never, 'tenant-1');

    expect(result).toEqual(expect.objectContaining({
      aiReceptionEnabled: true,
      tone: 'light_gulf',
      managerApprovalTimeoutMinutes: 15,
      maxUnderstandingFailures: 2,
      escalationCooldownMinutes: 10,
      bookingConfirmationMode: 'manual',
      availableSlotsLimit: 3,
    }));
  });

  it('clamps invalid stored values back to safe runtime defaults', async () => {
    const { service } = makeService({
      ai_tone: 'robotic',
      ai_approval_timeout_minutes: '0',
      ai_max_understanding_failures: '100',
      ai_escalation_cooldown_minutes: '-1',
      ai_available_slots_limit: '20',
      ai_booking_confirmation_mode: 'unsafe',
    });

    const result = await service.get({} as never, 'tenant-1');

    expect(result.tone).toBe('light_gulf');
    expect(result.managerApprovalTimeoutMinutes).toBe(15);
    expect(result.maxUnderstandingFailures).toBe(2);
    expect(result.escalationCooldownMinutes).toBe(10);
    expect(result.availableSlotsLimit).toBe(3);
    expect(result.bookingConfirmationMode).toBe('manual');
  });

  it('parses newline and comma separated phrase lists', async () => {
    const { service } = makeService({
      ai_avoided_phrases: 'حبيبتي\nالغالية',
      ai_custom_escalation_keywords: 'استرجاع,تعويض',
    });

    const result = await service.get({} as never, 'tenant-1');

    expect(result.avoidedPhrases).toEqual(['حبيبتي', 'الغالية']);
    expect(result.customEscalationKeywords).toEqual(['استرجاع', 'تعويض']);
  });
});

describe('AI reception setting validation', () => {
  it('rejects unsafe values at the settings API boundary', () => {
    expect(validateSetting('ai_tone', 'robotic')).toBeTruthy();
    expect(validateSetting('ai_approval_timeout_minutes', '0')).toBeTruthy();
    expect(validateSetting('ai_escalation_cooldown_minutes', '0')).toBeTruthy();
    expect(validateSetting('ai_available_slots_limit', '20')).toBeTruthy();
    expect(validateSetting('ai_booking_confirmation_mode', 'direct_create')).toBeTruthy();
  });

  it('accepts supported AI reception values', () => {
    expect(validateSetting('ai_tone', 'luxury')).toBeNull();
    expect(validateSetting('ai_approval_timeout_minutes', '15')).toBeNull();
    expect(validateSetting('ai_escalation_cooldown_minutes', '10')).toBeNull();
    expect(validateSetting('ai_available_slots_limit', '5')).toBeNull();
    expect(validateSetting('ai_booking_confirmation_mode', 'manual')).toBeNull();
  });
});
