export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial';

export type UserRole = 'owner' | 'manager' | 'receptionist' | 'cashier' | 'staff';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_paid' | 'voided' | 'refunded';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'wallet';

export type NotificationChannel = 'in_app' | 'push' | 'sms' | 'whatsapp' | 'email';
