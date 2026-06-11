import { AISafetyNetService, SafetyNetContext } from './ai-safety-net.service';
import type { SalonContextForAI } from './ai-context.builder';
import type { AIReceptionRuntimeSettings } from './ai-reception-settings.service';

const services: SalonContextForAI['services'] = [
  { id: 'svc-cut', name: 'قص وتصفيف', price: 80, duration: 60, category: 'hair' },
  { id: 'svc-dye', name: 'صبغة كاملة', price: 150, duration: 120, category: 'hair' },
];

function makeSettings(overrides: Partial<AIReceptionRuntimeSettings> = {}): AIReceptionRuntimeSettings {
  return {
    aiReceptionEnabled: true,
    aiManagerPhone: '',
    tone: 'light_gulf',
    welcomeMessage: '',
    managerApprovalTimeoutMinutes: 15,
    maxUnderstandingFailures: 2,
    escalationCooldownMinutes: 10,
    bookingConfirmationMode: 'manual',
    privacyMessageEnabled: false,
    privacyMessage: '',
    avoidedPhrases: [],
    customEscalationKeywords: [],
    showEmployeeNamesToCustomers: false,
    availableSlotsLimit: 3,
    mode: 'full',
    walkInMessage: '',
    customRedirectMessage: '',
    assistantName: 'مساعد',
    voiceEnabled: true,
    richMediaEnabled: true,
    clientMemoryEnabled: true,
    weeklyReportEnabled: true,
    tier: 'premium',
    monthlyMessageLimit: 5000,
    messagesUsedThisMonth: 0,
    vacationStartDate: '',
    vacationEndDate: '',
    vacationMessage: '',
    proactiveFollowUpEnabled: true,
    proactiveReEngagementEnabled: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<SafetyNetContext> = {}): SafetyNetContext {
  return {
    services,
    settings: makeSettings(),
    ...overrides,
  };
}

describe('AISafetyNetService', () => {
  const svc = new AISafetyNetService();

  describe('validatePrices', () => {
    it('rewrites a wrong price to the official catalogue price', () => {
      const { reply, adjusted } = svc.validatePrices('سعر قص وتصفيف 50 ر.س', services);
      expect(adjusted).toBe(true);
      expect(reply).toContain('80');
      expect(reply).not.toContain('50');
    });

    it('leaves correct prices untouched', () => {
      const { reply, adjusted } = svc.validatePrices('سعر قص وتصفيف 80 ر.س', services);
      expect(adjusted).toBe(false);
      expect(reply).toContain('80');
    });

    it('does nothing when no services are known', () => {
      const { reply, adjusted } = svc.validatePrices('any 999 ر.س', []);
      expect(adjusted).toBe(false);
      expect(reply).toBe('any 999 ر.س');
    });
  });

  describe('blockPrematureConfirmation', () => {
    it('replaces "تم الحجز" with the safe placeholder', () => {
      const result = svc.blockPrematureConfirmation('تم الحجز يا غالية', 'بانتظار التأكيد');
      expect(result.blocked).toBe(true);
      expect(result.reply).toBe('بانتظار التأكيد');
    });

    it('catches English variants', () => {
      const result = svc.blockPrematureConfirmation('your booking confirmed', 'pending');
      expect(result.blocked).toBe(true);
    });

    it('passes through normal replies', () => {
      const result = svc.blockPrematureConfirmation('سأرسل طلبك للصالون', 'pending');
      expect(result.blocked).toBe(false);
      expect(result.reply).toBe('سأرسل طلبك للصالون');
    });
  });

  describe('removeAIIdentityLeaks', () => {
    it('strips Arabic AI confessions', () => {
      const { reply, redactions } = svc.removeAIIdentityLeaks('أنا بوت لكن سأساعدك');
      expect(redactions).toBeGreaterThan(0);
      expect(reply).not.toContain('بوت');
    });

    it('strips English AI confessions', () => {
      const { reply, redactions } = svc.removeAIIdentityLeaks("I'm an AI assistant here to help");
      expect(redactions).toBeGreaterThan(0);
      expect(reply.toLowerCase()).not.toContain('ai');
    });

    it('redacts model names like ChatGPT and GPT-5', () => {
      const { reply, redactions } = svc.removeAIIdentityLeaks('powered by ChatGPT and GPT-5');
      expect(redactions).toBeGreaterThan(0);
      expect(reply).not.toContain('ChatGPT');
      expect(reply).not.toContain('GPT-5');
    });
  });

  describe('applyAvoidedPhrases', () => {
    it('replaces banned phrases with the neutral fallback', () => {
      const reply = svc.applyAvoidedPhrases('حياج حبيبتي والله الغالية', ['حبيبتي', 'الغالية']);
      expect(reply).not.toContain('حبيبتي');
      expect(reply).not.toContain('الغالية');
      expect(reply).toContain('حياك الله');
    });

    it('returns the input untouched when list is empty', () => {
      expect(svc.applyAvoidedPhrases('hello', [])).toBe('hello');
    });
  });

  describe('truncateIfNeeded', () => {
    it('truncates beyond max line cap', () => {
      const input = ['l1', 'l2', 'l3', 'l4', 'l5'].join('\n');
      const { reply, truncated } = svc.truncateIfNeeded(input, 3);
      expect(truncated).toBe(true);
      expect(reply.split('\n')).toHaveLength(3);
    });

    it('passes through short replies', () => {
      const { reply, truncated } = svc.truncateIfNeeded('one\ntwo', 3);
      expect(truncated).toBe(false);
      expect(reply).toBe('one\ntwo');
    });
  });

  describe('limitEmojis', () => {
    it('keeps the first emoji, drops the rest', () => {
      const { reply, truncated } = svc.limitEmojis('مرحبا 😊 كيف 🌷 الحال 🤍', 1);
      expect(truncated).toBe(true);
      const emojiCount = [...reply].filter((c) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(c)).length;
      expect(emojiCount).toBe(1);
    });

    it('does nothing when within budget', () => {
      const { reply, truncated } = svc.limitEmojis('مرحبا 😊', 1);
      expect(truncated).toBe(false);
      expect(reply).toBe('مرحبا 😊');
    });
  });

  describe('sanitize (orchestrator)', () => {
    it('runs all six guards in order and returns the cleaned reply', () => {
      const result = svc.sanitize(
        'تم الحجز يا حبيبتي 😊🌷🤍\nسطر2\nسطر3\nسطر4',
        ctx({ settings: makeSettings({ avoidedPhrases: ['حبيبتي'] }) }),
      );
      expect(result.blockedConfirmation).toBe(true);
      // Premature replacement is the standard Arabic pending-approval text — no
      // emojis, no banned words, single line — passes the rest of the chain.
      expect(result.reply).toContain('بانتظار');
    });

    it('fixes price + redacts identity in one pass', () => {
      const result = svc.sanitize(
        'أنا بوت بس سعر قص وتصفيف 50 ر.س',
        ctx(),
      );
      expect(result.identityRedactions).toBeGreaterThan(0);
      expect(result.pricesAdjusted).toBe(true);
      expect(result.reply).toContain('80');
      expect(result.reply).not.toContain('بوت');
    });
  });
});
