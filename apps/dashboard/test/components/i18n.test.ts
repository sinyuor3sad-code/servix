import { describe, it, expect } from 'vitest';
import {
  createTranslator,
  getSavedLocale,
  getDirection,
  getMessages,
} from '@/lib/i18n';

describe('i18n utilities', () => {
  describe('createTranslator', () => {
    it('should translate a simple key in Arabic', () => {
      const t = createTranslator('ar');
      expect(t('common.save')).toBe('حفظ');
    });

    it('should translate a simple key in English', () => {
      const t = createTranslator('en');
      expect(t('common.save')).toBe('Save');
    });

    it('should return key for non-existent path', () => {
      const t = createTranslator('ar');
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('should interpolate parameters', () => {
      const t = createTranslator('en');
      const result = t('dashboard.greeting', { name: 'Ahmed' });
      expect(result).toBe('Hello, Ahmed');
    });

    it('should interpolate Arabic greeting', () => {
      const t = createTranslator('ar');
      const result = t('dashboard.greeting', { name: 'أحمد' });
      expect(result).toBe('مرحباً، أحمد');
    });

    it('should handle deep nested keys', () => {
      const t = createTranslator('ar');
      expect(t('appointments.confirmed')).toBe('مؤكد');
    });
  });

  describe('getMessages', () => {
    it('should return Arabic messages', () => {
      const msgs = getMessages('ar');
      expect(msgs.meta.direction).toBe('rtl');
    });

    it('should return English messages', () => {
      const msgs = getMessages('en');
      expect(msgs.meta.direction).toBe('ltr');
    });
  });

  describe('getDirection', () => {
    it('should return rtl for Arabic', () => {
      expect(getDirection('ar')).toBe('rtl');
    });

    it('should return ltr for English', () => {
      expect(getDirection('en')).toBe('ltr');
    });
  });

  describe('getSavedLocale', () => {
    it('should default to ar when no localStorage', () => {
      expect(getSavedLocale()).toBe('ar');
    });
  });
});
