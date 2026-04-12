import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(() => {
    service = new CalendarService();
  });

  describe('generateGoogleCalendarUrl', () => {
    it('should produce a valid Google Calendar URL', () => {
      const url = service.generateGoogleCalendarUrl({
        title: '✂️ قص شعر - صالون الجمال',
        description: 'مع: أحمد | السعر: 60 ر.س',
        location: 'الرياض',
        startDate: new Date('2026-04-15T13:30:00Z'),
        endDate: new Date('2026-04-15T14:30:00Z'),
      });

      expect(url).toContain('https://calendar.google.com/calendar/render');
      expect(url).toContain('action=TEMPLATE');
      expect(url).toContain('dates=');
      // Check date range format (YYYYMMDD pattern)
      expect(url).toMatch(/dates=\d{8}T\d{6}Z.*\d{8}T\d{6}Z/);
    });

    it('should URL-encode Arabic text', () => {
      const url = service.generateGoogleCalendarUrl({
        title: 'قص شعر',
        description: 'وصف',
        location: 'الرياض',
        startDate: new Date(),
        endDate: new Date(),
      });

      // Arabic text should be encoded
      expect(url).not.toContain('قص');
      expect(url).toContain('%');
    });
  });

  describe('generateIcsFile', () => {
    it('should produce valid ICS content with VALARM reminders', () => {
      const ics = service.generateIcsFile({
        title: 'قص شعر',
        description: 'مع أحمد',
        location: 'الرياض',
        startDate: new Date('2026-04-15T13:30:00Z'),
        endDate: new Date('2026-04-15T14:30:00Z'),
      });

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('DTSTART:');
      expect(ics).toContain('DTEND:');
      // Should have 2 VALARM reminders
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-PT60M');
      expect(ics).toContain('TRIGGER:-PT1440M');
    });

    it('should use custom reminder minutes if provided', () => {
      const ics = service.generateIcsFile({
        title: 'test',
        description: 'test desc',
        location: 'test loc',
        startDate: new Date(),
        endDate: new Date(),
        reminderMinutes: [30, 120],
      });

      expect(ics).toContain('TRIGGER:-PT30M');
      expect(ics).toContain('TRIGGER:-PT120M');
    });
  });

  describe('generateBookingCalendarMessage', () => {
    it('should produce a formatted WhatsApp message with calendar link', () => {
      const msg = service.generateBookingCalendarMessage(
        'قص شعر + لحية',
        'أحمد',
        'صالون الجمال',
        'الرياض',
        new Date('2026-04-15T13:30:00Z'),
        60,
        60,
      );

      expect(msg).toContain('تم الحجز! ✅');
      expect(msg).toContain('قص شعر + لحية');
      expect(msg).toContain('أحمد');
      expect(msg).toContain('60 ر.س');
      expect(msg).toContain('calendar.google.com');
    });
  });
});
