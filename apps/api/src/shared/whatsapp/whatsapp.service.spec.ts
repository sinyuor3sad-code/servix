import { WhatsAppService, WhatsAppCredentials } from './whatsapp.service';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Pass-through breaker mock: behaviour under test is the HTTP layer, not
// the breaker state machine (which is covered in circuit-breaker.service.spec).
function makeBreakerMock() {
  return {
    createBreaker: jest.fn((_name: string, fn: (...args: any[]) => Promise<any>) => ({
      fire: (...args: any[]) => fn(...args),
      fallback: jest.fn(),
      on: jest.fn(),
    })),
  } as unknown as CircuitBreakerService;
}

describe('WhatsAppService', () => {
  let service: WhatsAppService;

  const validCredentials: WhatsAppCredentials = {
    token: 'test-token-123',
    phoneNumberId: 'phone-id-456',
  };

  beforeEach(() => {
    service = new WhatsAppService(makeBreakerMock());
    service.onModuleInit();
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('يجب إرسال رسالة واتساب بنجاح', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await service.send(
        { to: '0501234567', message: 'مرحباً' },
        validCredentials,
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('phone-id-456/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        }),
      );
    });

    it('يجب تحويل رقم 05xx إلى 9665xx', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await service.send(
        { to: '0512345678', message: 'اختبار' },
        validCredentials,
      );

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.to).toBe('966512345678');
    });

    it('يجب تمرير الرقم الذي يبدأ بـ 966 كما هو', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await service.send(
        { to: '966501234567', message: 'اختبار' },
        validCredentials,
      );

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.to).toBe('966501234567');
    });

    it('يجب عدم إرسال عند عدم وجود credentials', async () => {
      await service.send(
        { to: '0501234567', message: 'اختبار' },
        null,
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('يجب عدم إرسال عند وجود token فارغ', async () => {
      await service.send(
        { to: '0501234567', message: 'اختبار' },
        { token: '', phoneNumberId: 'phone-id' },
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('يجب رمي Error عند فشل الإرسال', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        service.send(
          { to: '0501234567', message: 'اختبار' },
          validCredentials,
        ),
      ).rejects.toThrow('WhatsApp send failed: 401');
    });
  });

  describe('sendDocument', () => {
    it('يجب رفع الملف ثم إرسال الوثيقة', async () => {
      // First call: upload media
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'media-id-789' }),
        })
        // Second call: send document message
        .mockResolvedValueOnce({ ok: true });

      const doc = Buffer.from('fake-pdf-content');

      await service.sendDocument(
        { to: '0501234567', document: doc, filename: 'invoice.pdf', caption: 'فاتورتك' },
        validCredentials,
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second call should reference the media ID
      const secondCall = mockFetch.mock.calls[1];
      const body = JSON.parse(secondCall[1].body);
      expect(body.type).toBe('document');
      expect(body.document.id).toBe('media-id-789');
      expect(body.document.filename).toBe('invoice.pdf');
      expect(body.document.caption).toBe('فاتورتك');
    });

    it('يجب عدم إرسال عند عدم وجود credentials', async () => {
      const doc = Buffer.from('fake-pdf');

      await service.sendDocument(
        { to: '0501234567', document: doc, filename: 'test.pdf' },
        null,
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('يجب رمي Error عند فشل رفع الملف', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      });

      const doc = Buffer.from('fake-pdf');

      await expect(
        service.sendDocument(
          { to: '0501234567', document: doc, filename: 'test.pdf' },
          validCredentials,
        ),
      ).rejects.toThrow('WhatsApp media upload failed: 500');
    });

    it('يجب رمي Error عند عدم إرجاع media ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const doc = Buffer.from('fake-pdf');

      await expect(
        service.sendDocument(
          { to: '0501234567', document: doc, filename: 'test.pdf' },
          validCredentials,
        ),
      ).rejects.toThrow('WhatsApp media upload returned no ID');
    });

    it('يجب قص التعليق الطويل عند 1024 حرف', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'media-id' }),
        })
        .mockResolvedValueOnce({ ok: true });

      const longCaption = 'أ'.repeat(2000);
      const doc = Buffer.from('fake-pdf');

      await service.sendDocument(
        { to: '0501234567', document: doc, filename: 'test.pdf', caption: longCaption },
        validCredentials,
      );

      const secondCall = mockFetch.mock.calls[1];
      const body = JSON.parse(secondCall[1].body);
      expect(body.document.caption.length).toBe(1024);
    });
  });
});
