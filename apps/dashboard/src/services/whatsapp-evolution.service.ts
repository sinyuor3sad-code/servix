import { api } from '@/lib/api';

export type WhatsAppInstanceStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'qr_pending'
  | 'banned'
  | 'error';

export interface WhatsAppInstance {
  instanceName: string;
  status: WhatsAppInstanceStatus;
  phoneNumber: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  lastConnectedAt: string | null;
  qrCode: string | null;
}

export interface WhatsAppOptOut {
  id: string;
  phone: string;
  reason: string | null;
  createdAt: string;
}

const BASE = '/salon/whatsapp/evolution';

export const whatsappEvolutionService = {
  getOrCreateInstance: (token: string) =>
    api.post<WhatsAppInstance>(`${BASE}/instance`, {}, token),

  getStatus: (token: string) =>
    api.get<WhatsAppInstance | null>(`${BASE}/instance/status`, token),

  reconnect: (token: string) =>
    api.post<{ qrCode: string | null }>(`${BASE}/instance/reconnect`, {}, token),

  deleteInstance: (token: string) =>
    api.delete<void>(`${BASE}/instance`, token),

  sendText: (token: string, body: { to: string; message: string; isMarketing?: boolean }) =>
    api.post<{ delayMs: number }>(`${BASE}/send`, body, token),

  listOptOuts: (token: string) =>
    api.get<WhatsAppOptOut[]>(`${BASE}/opt-outs`, token),

  addOptOut: (token: string, body: { phone: string; reason?: string }) =>
    api.post<void>(`${BASE}/opt-outs`, body, token),

  removeOptOut: (token: string, phone: string) =>
    api.delete<void>(`${BASE}/opt-outs/${encodeURIComponent(phone)}`, token),
};
