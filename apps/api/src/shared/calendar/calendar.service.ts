import { Injectable } from '@nestjs/common';

// ─────────────────── Types ───────────────────

export interface CalendarEventOptions {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  reminderMinutes?: number[];
}

/**
 * Calendar Service — Generates calendar links and .ics files for appointments.
 *
 * Features:
 * - Google Calendar URL generation (works on Android + desktop)
 * - ICS file generation (works on iOS/Apple Calendar + Outlook)
 * - Pre-formatted WhatsApp booking confirmation messages with calendar links
 * - Auto-reminders: 24 hours and 1 hour before appointment (free via calendar app)
 *
 * All dates are handled in Asia/Riyadh timezone (UTC+3).
 */
@Injectable()
export class CalendarService {
  /**
   * Generate a Google Calendar URL.
   * When clicked, opens Google Calendar with the event pre-filled.
   * Works on: Android (opens Calendar app), Desktop (opens web), iOS (opens browser).
   */
  generateGoogleCalendarUrl(options: CalendarEventOptions): string {
    const formatDate = (d: Date): string => {
      // Format: YYYYMMDDTHHmmssZ (UTC)
      return d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: options.title,
      dates: `${formatDate(options.startDate)}/${formatDate(options.endDate)}`,
      details: options.description,
      location: options.location,
      // Add reminders (Google Calendar specific)
      // Note: Google Calendar URL doesn't natively support reminders in the URL,
      // but the user's default calendar reminders will apply
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * Generate an ICS (iCalendar) file content.
   * When opened, adds event to Apple Calendar, Outlook, or any calendar app.
   *
   * Includes VALARM reminders:
   * - 24 hours before (1440 minutes)
   * - 1 hour before (60 minutes)
   */
  generateIcsFile(options: CalendarEventOptions): string {
    const formatDate = (d: Date): string => {
      // Format: YYYYMMDDTHHmmssZ
      return (
        d
          .toISOString()
          .replace(/[-:]/g, '')
          .split('.')[0] + 'Z'
      );
    };

    const reminderMinutes = options.reminderMinutes || [60, 1440]; // 1 hour + 24 hours
    const alarms = reminderMinutes
      .map(
        (m) =>
          `BEGIN:VALARM\r\nTRIGGER:-PT${m}M\r\nACTION:DISPLAY\r\nDESCRIPTION:تذكير بموعدك\r\nEND:VALARM`,
      )
      .join('\r\n');

    // Generate a unique ID for the event
    const uid = `servix-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@servi-x.com`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SERVIX//Salon Booking//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatDate(options.startDate)}`,
      `DTEND:${formatDate(options.endDate)}`,
      `SUMMARY:${this.escapeIcsText(options.title)}`,
      `DESCRIPTION:${this.escapeIcsText(options.description)}`,
      `LOCATION:${this.escapeIcsText(options.location)}`,
      'STATUS:CONFIRMED',
      alarms,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /**
   * Generate a formatted WhatsApp message with calendar link for booking confirmation.
   *
   * Output format:
   * ────────────────────
   * تم الحجز! ✅
   * ✂️ قص شعر + لحية
   * 📅 السبت 15 أبريل - 4:30 مساءً
   * 👤 مع: أحمد
   * 💰 60 ر.س
   *
   * 📅 أضف لتقويمك (يذكّرك تلقائياً):
   * https://calendar.google.com/calendar/render?...
   * ────────────────────
   */
  generateBookingCalendarMessage(
    serviceName: string,
    employeeName: string,
    salonName: string,
    salonAddress: string,
    date: Date,
    durationMinutes: number,
    price: number,
  ): string {
    const endDate = new Date(date.getTime() + durationMinutes * 60000);

    const googleUrl = this.generateGoogleCalendarUrl({
      title: `✂️ ${serviceName} - ${salonName}`,
      description: `مع: ${employeeName} | السعر: ${price} ر.س\n\nتمت الحجز عبر SERVIX`,
      location: salonAddress,
      startDate: date,
      endDate,
    });

    // Format date in Arabic-friendly way
    const dateStr = this.formatArabicDate(date);
    const timeStr = this.formatArabicTime(date);

    return [
      `تم الحجز! ✅`,
      `✂️ ${serviceName}`,
      `📅 ${dateStr} - ${timeStr}`,
      `👤 مع: ${employeeName}`,
      `💰 ${price} ر.س`,
      ``,
      `📅 أضف لتقويمك (يذكّرك تلقائياً ⏰):`,
      googleUrl,
    ].join('\n');
  }

  /**
   * Generate just the calendar URL for an appointment.
   * Used by AppointmentsService to attach to API responses.
   */
  generateAppointmentCalendarUrl(options: {
    serviceName: string;
    employeeName: string;
    salonName: string;
    salonAddress: string;
    startDate: Date;
    durationMinutes: number;
    price: number;
  }): string {
    const endDate = new Date(
      options.startDate.getTime() + options.durationMinutes * 60000,
    );

    return this.generateGoogleCalendarUrl({
      title: `✂️ ${options.serviceName} - ${options.salonName}`,
      description: `مع: ${options.employeeName} | السعر: ${options.price} ر.س`,
      location: options.salonAddress,
      startDate: options.startDate,
      endDate,
    });
  }

  // ─── Private Helpers ───

  /**
   * Escape special characters for ICS format.
   */
  private escapeIcsText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Format a date in Arabic style: "السبت 15 أبريل"
   */
  private formatArabicDate(date: Date): string {
    const days = [
      'الأحد',
      'الاثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت',
    ];
    const months = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];

    // Adjust to Riyadh timezone (UTC+3)
    const riyadh = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const dayName = days[riyadh.getUTCDay()];
    const dayNum = riyadh.getUTCDate();
    const monthName = months[riyadh.getUTCMonth()];

    return `${dayName} ${dayNum} ${monthName}`;
  }

  /**
   * Format time in Arabic style: "4:30 مساءً"
   */
  private formatArabicTime(date: Date): string {
    // Adjust to Riyadh timezone (UTC+3)
    const riyadh = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    let hours = riyadh.getUTCHours();
    const minutes = riyadh.getUTCMinutes();
    const period = hours >= 12 ? 'مساءً' : 'صباحاً';

    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;

    const minuteStr = String(minutes).padStart(2, '0');
    return `${hours}:${minuteStr} ${period}`;
  }
}
