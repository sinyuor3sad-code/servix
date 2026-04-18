import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badgeCount?: number;
}

/**
 * Push Notification Service
 * Sends push notifications via Firebase Cloud Messaging (FCM).
 * Supports both individual device and topic-based messaging.
 */
@Injectable()
export class PushNotificationService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationService.name);
  private admin: any = null;
  private fcmDeviceBreaker!: CircuitBreaker<[any], string | null>;
  private fcmTopicBreaker!: CircuitBreaker<[any], string | null>;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.initFirebase();
  }

  onModuleInit() {
    // FCM has its own retry/rate-limit handling; breaker only protects against
    // outright outage. 10s is generous for a single FCM send.
    this.fcmDeviceBreaker = this.circuitBreaker.createBreaker(
      'push-fcm-device',
      (message: any) => this.sendMessageRaw(message),
      { timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
    this.fcmDeviceBreaker.fallback(() => null);

    this.fcmTopicBreaker = this.circuitBreaker.createBreaker(
      'push-fcm-topic',
      (message: any) => this.sendMessageRaw(message),
      { timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
    this.fcmTopicBreaker.fallback(() => null);
  }

  private async sendMessageRaw(message: any): Promise<string | null> {
    if (!this.admin) return null;
    return this.admin.messaging().send(message);
  }

  private initFirebase(): void {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      if (!projectId) {
        this.logger.warn('Firebase not configured — push notifications disabled');
        return;
      }

      // Lazy load: firebase-admin is optional — only used if FIREBASE_PROJECT_ID is set.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const admin = require('firebase-admin');
      if (!admin.apps?.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
            privateKey: this.configService
              .get<string>('FIREBASE_PRIVATE_KEY', '')
              .replace(/\\n/g, '\n'),
          }),
        });
      }
      this.admin = admin;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.warn('Firebase initialization failed — push disabled', error);
    }
  }

  /**
   * Send push notification to a specific device (through circuit breaker)
   */
  async sendToDevice(fcmToken: string, payload: PushPayload): Promise<string | null> {
    if (!this.admin) {
      this.logger.debug('Push skipped — Firebase not configured');
      return null;
    }

    const message = {
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'servix-default',
          sound: 'default',
          clickAction: 'OPEN_ACTIVITY',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: payload.badgeCount ?? 1,
            'content-available': 1,
          },
        },
      },
    };

    const messageId = await this.fcmDeviceBreaker.fire(message).catch((error) => {
      this.logger.error(`Push to device failed: ${error}`);
      return null;
    });

    if (messageId) this.logger.debug(`Push sent to device: ${messageId}`);
    return messageId;
  }

  /**
   * Send push notification to a topic (through circuit breaker)
   */
  async sendToTopic(topic: string, payload: PushPayload): Promise<string | null> {
    if (!this.admin) return null;

    const message = {
      topic,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
    };

    const messageId = await this.fcmTopicBreaker.fire(message).catch((error) => {
      this.logger.error(`Push to topic ${topic} failed: ${error}`);
      return null;
    });

    if (messageId) this.logger.debug(`Push sent to topic ${topic}: ${messageId}`);
    return messageId;
  }

  /**
   * Send notification for new appointment
   */
  async notifyNewAppointment(
    fcmToken: string,
    appointmentData: { clientName: string; serviceName: string; dateTime: string; appointmentId: string },
  ): Promise<void> {
    await this.sendToDevice(fcmToken, {
      title: 'حجز جديد 📅',
      body: `${appointmentData.clientName} — ${appointmentData.serviceName}`,
      data: {
        type: 'appointment',
        id: appointmentData.appointmentId,
        action: 'view',
      },
    });
  }

  /**
   * Send notification for cancelled appointment
   */
  async notifyCancelledAppointment(
    fcmToken: string,
    data: { clientName: string; appointmentId: string },
  ): Promise<void> {
    await this.sendToDevice(fcmToken, {
      title: 'تم إلغاء الحجز ❌',
      body: `قام ${data.clientName} بإلغاء الحجز`,
      data: { type: 'appointment_cancelled', id: data.appointmentId },
    });
  }

  /**
   * Send notification for upcoming appointment (1 hour before)
   */
  async notifyUpcomingAppointment(
    fcmToken: string,
    data: { clientName: string; appointmentId: string; time: string },
  ): Promise<void> {
    await this.sendToDevice(fcmToken, {
      title: 'موعد قادم خلال ساعة ⏰',
      body: `${data.clientName} — ${data.time}`,
      data: { type: 'appointment_reminder', id: data.appointmentId },
    });
  }

  /**
   * Send notification for successful payment
   */
  async notifyPaymentSuccess(
    fcmToken: string,
    data: { amount: number; invoiceId: string },
  ): Promise<void> {
    await this.sendToDevice(fcmToken, {
      title: 'تم الدفع بنجاح 💳',
      body: `تم استلام ${data.amount} ريال`,
      data: { type: 'payment_success', id: data.invoiceId },
    });
  }
}
