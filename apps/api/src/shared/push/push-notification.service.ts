import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private admin: any = null;

  constructor(private readonly configService: ConfigService) {
    this.initFirebase();
  }

  private initFirebase(): void {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      if (!projectId) {
        this.logger.warn('Firebase not configured — push notifications disabled');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
   * Send push notification to a specific device
   */
  async sendToDevice(fcmToken: string, payload: PushPayload): Promise<string | null> {
    if (!this.admin) {
      this.logger.debug('Push skipped — Firebase not configured');
      return null;
    }

    try {
      const messageId = await this.admin.messaging().send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
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
      });

      this.logger.debug(`Push sent to device: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Push to device failed: ${error}`);
      return null;
    }
  }

  /**
   * Send push notification to a topic (e.g., tenant-specific)
   */
  async sendToTopic(topic: string, payload: PushPayload): Promise<string | null> {
    if (!this.admin) return null;

    try {
      const messageId = await this.admin.messaging().send({
        topic,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      });

      this.logger.debug(`Push sent to topic ${topic}: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`Push to topic ${topic} failed: ${error}`);
      return null;
    }
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
