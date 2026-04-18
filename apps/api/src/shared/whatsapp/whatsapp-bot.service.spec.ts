import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppBotService, IncomingMessage } from './whatsapp-bot.service';
import { WhatsAppService } from './whatsapp.service';
import { TenantResolverService } from './tenant-resolver.service';
import { GeminiService } from '../ai/gemini.service';
import { CalendarService } from '../calendar/calendar.service';
import { FeaturesService } from '../../core/features/features.service';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';

describe('WhatsAppBotService', () => {
  let service: WhatsAppBotService;
  let mockWhatsApp: any;
  let mockResolver: any;
  let mockGemini: any;
  let mockCalendar: any;
  let mockFeatures: any;

  beforeEach(async () => {
    mockWhatsApp = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockResolver = {
      resolveByPhoneNumberId: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        salonName: 'صالون الجمال',
        databaseName: 'salon_1',
        credentials: { phoneNumberId: '123', token: 'token-123' },
      }),
      getSalonContext: jest.fn().mockResolvedValue({
        salonName: 'صالون الجمال',
        services: [{ name: 'قص شعر', price: 50, duration: 30 }],
      }),
    };

    mockGemini = {
      chat: jest.fn().mockResolvedValue('أهلاً! يسعدني خدمتك.'),
      transcribeAudio: jest.fn().mockResolvedValue('أبي أحجز موعد'),
      describeImage: jest.fn().mockResolvedValue('صورة لتسريحة شعر'),
    };

    mockCalendar = {
      generateAppointmentCalendarUrl: jest.fn().mockReturnValue('https://calendar.google.com/...'),
    };

    mockFeatures = {
      isFeatureEnabled: jest.fn().mockResolvedValue({ isEnabled: true }),
    };

    const mockCircuitBreaker: Partial<CircuitBreakerService> = {
      createBreaker: jest.fn((_name: string, fn: any) => ({
        fire: (...args: any[]) => fn(...args),
        fallback: jest.fn(),
        on: jest.fn(),
      })) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppBotService,
        { provide: WhatsAppService, useValue: mockWhatsApp },
        { provide: TenantResolverService, useValue: mockResolver },
        { provide: GeminiService, useValue: mockGemini },
        { provide: CalendarService, useValue: mockCalendar },
        { provide: FeaturesService, useValue: mockFeatures },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
      ],
    }).compile();

    await module.init();
    service = module.get<WhatsAppBotService>(WhatsAppBotService);
  });

  describe('processIncomingMessage — text', () => {
    it('should resolve tenant, get AI response, and send reply', async () => {
      const msg: IncomingMessage = {
        from: '+966500000000',
        phoneNumberId: '123',
        messageType: 'text',
        text: 'مرحبا',
        timestamp: '1700000000',
        messageId: 'msg-1',
      };

      await service.processIncomingMessage(msg);

      // 1. Resolved tenant
      expect(mockResolver.resolveByPhoneNumberId).toHaveBeenCalledWith('123');

      // 2. Got salon context
      expect(mockResolver.getSalonContext).toHaveBeenCalledWith(
        'tenant-1',
        'salon_1',
        '+966500000000',
      );

      // 3. Called Gemini chat with correct params
      expect(mockGemini.chat).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userPhone: '+966500000000',
        userMessage: 'مرحبا',
        salonContext: expect.objectContaining({ salonName: 'صالون الجمال' }),
      });

      // 4. Sent WhatsApp reply
      expect(mockWhatsApp.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+966500000000',
          message: expect.stringContaining('أهلاً'),
        }),
        expect.objectContaining({ phoneNumberId: '123' }),
      );
    });

    it('should skip processing if tenant not found', async () => {
      mockResolver.resolveByPhoneNumberId.mockResolvedValue(null);

      const msg: IncomingMessage = {
        from: '+966500000000',
        phoneNumberId: 'unknown-phone',
        messageType: 'text',
        text: 'مرحبا',
        timestamp: '1700000000',
        messageId: 'msg-2',
      };

      await service.processIncomingMessage(msg);

      expect(mockGemini.chat).not.toHaveBeenCalled();
      expect(mockWhatsApp.send).not.toHaveBeenCalled();
    });
  });

  describe('processIncomingMessage — interactive', () => {
    it('should handle interactive button reply', async () => {
      const msg: IncomingMessage = {
        from: '+966500000000',
        phoneNumberId: '123',
        messageType: 'interactive',
        interactive: { button_reply: { title: 'نعم، أريد حجز' } },
        timestamp: '1700000000',
        messageId: 'msg-3',
      };

      await service.processIncomingMessage(msg);

      expect(mockGemini.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: 'نعم، أريد حجز',
        }),
      );
    });
  });

  describe('Full flow — webhook to response', () => {
    it('should complete the full flow: receive → resolve → AI → reply', async () => {
      mockGemini.chat.mockResolvedValue('أهلاً! عندنا قص شعر بـ 50 ريال. تبي تحجز?');

      const msg: IncomingMessage = {
        from: '+966511111111',
        phoneNumberId: '123',
        messageType: 'text',
        text: 'كم سعر القص؟',
        timestamp: '1700000000',
        messageId: 'msg-integration',
      };

      await service.processIncomingMessage(msg);

      // Verify the complete chain
      expect(mockResolver.resolveByPhoneNumberId).toHaveBeenCalledTimes(1);
      expect(mockResolver.getSalonContext).toHaveBeenCalledTimes(1);
      expect(mockGemini.chat).toHaveBeenCalledTimes(1);
      expect(mockWhatsApp.send).toHaveBeenCalledTimes(1);

      // Verify the response content
      const sendCall = mockWhatsApp.send.mock.calls[0];
      expect(sendCall[0].message).toContain('50 ريال');
    });
  });
});
