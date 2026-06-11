import { ConflictException } from '@nestjs/common';
import { AIReceptionBookingService } from './ai-reception-booking.service';
import type { AppointmentsService } from '../appointments/appointments.service';

function makeDb(overrides: Record<string, unknown> = {}) {
  const service = { id: 'svc-1', nameAr: 'قص وتصفيف', price: 80, duration: 60 };
  const employee = {
    id: 'emp-1',
    employeeSchedules: [{ startTime: '10:00', endTime: '16:00', isDayOff: false }],
    employeeBreaks: [],
  };

  return {
    service: { findFirst: jest.fn().mockResolvedValue(service) },
    salonInfo: { findFirst: jest.fn().mockResolvedValue({ slotDuration: 30, bufferTime: 10 }) },
    employee: { findMany: jest.fn().mockResolvedValue([employee]) },
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
    client: {
      findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }),
      create: jest.fn(),
    },
    aIPendingAction: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(({ where }: any) => Promise.resolve({
        id: where.id,
        status: 'approved',
        payload: {
          serviceId: 'svc-1',
          date: '2026-04-25',
          time: '14:00',
          clientName: 'سعد',
          quotedPrice: 80,
        },
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function makeService(appointmentsCreate = jest.fn().mockResolvedValue({ id: 'appt-1' })) {
  const appointmentsService = {
    create: appointmentsCreate,
  } as unknown as AppointmentsService;
  return {
    service: new AIReceptionBookingService(appointmentsService),
    appointmentsCreate,
  };
}

const action = {
  id: 123,
  status: 'awaiting_manager',
  payload: {
    serviceId: 'svc-1',
    date: '2026-04-25',
    time: '14:00',
    clientName: 'سعد',
    quotedPrice: 80,
  },
  customerPhone: '966500000000',
  conversationId: 'conv-1',
  doNotDisturb: false,
  expiresAt: new Date('2026-04-25T12:00:00.000Z'),
};

describe('AIReceptionBookingService phase 5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not list a slot outside employee working hours', async () => {
    const { service } = makeService();
    const db = makeDb();

    const result = await service.verifyRequestedSlot(db as never, {
      serviceId: 'svc-1',
      dateText: '2026-04-25',
      timeText: '09:00',
    });

    expect(result.status).toBe('unavailable');
  });

  it('does not list a booked overlapping time for the same employee', async () => {
    const { service } = makeService();
    const db = makeDb({
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          { employeeId: 'emp-1', startTime: '14:00', endTime: '15:00', appointmentServices: [] },
        ]),
      },
    });

    const result = await service.verifyRequestedSlot(db as never, {
      serviceId: 'svc-1',
      dateText: '2026-04-25',
      timeText: '14:30',
    });

    expect(result.status).toBe('unavailable');
  });

  it('does not list a slot when service duration does not fit before closing', async () => {
    const { service } = makeService();
    const db = makeDb({
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', nameAr: 'صبغة', price: 150, duration: 120 }) },
      employee: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'emp-1',
          employeeSchedules: [{ startTime: '10:00', endTime: '11:00', isDayOff: false }],
          employeeBreaks: [],
        }]),
      },
    });

    const result = await service.getAvailableSlotsForConversation(db as never, {
      serviceId: 'svc-1',
      dateText: '2026-04-25',
    });

    expect(result.status).toBe('unavailable');
    expect(result.slots).toEqual([]);
  });

  it('creates an appointment only through AppointmentsService.create after rechecking availability', async () => {
    const { service, appointmentsCreate } = makeService();
    const db = makeDb();

    const result = await service.createConfirmedAppointmentFromAction(db as never, {
      action,
      allowedStatuses: ['awaiting_manager'],
      claimStatus: 'approved',
      actorPhone: '966511111111',
      now: new Date('2026-04-24T12:00:00.000Z'),
    });

    expect(result.status).toBe('created');
    expect(result.appointmentId).toBe('appt-1');
    expect(appointmentsCreate).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        clientId: 'client-1',
        employeeId: 'emp-1',
        date: '2026-04-25',
        startTime: '14:00',
        source: 'whatsapp',
        services: [{ serviceId: 'svc-1', employeeId: 'emp-1' }],
      }),
    );
    expect((db as any).appointment.create).toBeUndefined();
  });

  it('does not create an appointment when date or time is ambiguous', async () => {
    const { service, appointmentsCreate } = makeService();
    const db = makeDb();

    const result = await service.createConfirmedAppointmentFromAction(db as never, {
      action: { ...action, payload: { ...action.payload, time: '2' } },
      allowedStatuses: ['awaiting_manager'],
      claimStatus: 'approved',
      actorPhone: '966511111111',
      now: new Date('2026-04-24T12:00:00.000Z'),
    });

    expect(result.status).toBe('ambiguous_time');
    expect(appointmentsCreate).not.toHaveBeenCalled();
  });

  it('returns conflict and avoids appointment creation when the selected employee is no longer available', async () => {
    const { service, appointmentsCreate } = makeService();
    const db = makeDb({
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          { employeeId: 'emp-1', startTime: '13:30', endTime: '15:00', appointmentServices: [] },
        ]),
      },
    });

    const result = await service.createConfirmedAppointmentFromAction(db as never, {
      action,
      allowedStatuses: ['awaiting_manager'],
      claimStatus: 'approved',
      actorPhone: '966511111111',
      now: new Date('2026-04-24T12:00:00.000Z'),
    });

    expect(result.status).toBe('conflict');
    expect(appointmentsCreate).not.toHaveBeenCalled();
  });

  it('converts official appointment conflicts to a safe conflict result', async () => {
    const { service, appointmentsCreate } = makeService(jest.fn().mockRejectedValue(new ConflictException('busy')));
    const db = makeDb();

    const result = await service.createConfirmedAppointmentFromAction(db as never, {
      action,
      allowedStatuses: ['awaiting_manager'],
      claimStatus: 'approved',
      actorPhone: '966511111111',
      now: new Date('2026-04-24T12:00:00.000Z'),
    });

    expect(result.status).toBe('conflict');
    expect(appointmentsCreate).toHaveBeenCalled();
  });
});
