import { NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';

// V-79: invoice_feedbacks.follow_up_status is now a Postgres enum
// (new | reviewed | contacted). These tests lock in the service-side guards that
// keep app input aligned with the enum so a bad value can't reach the DB.
function makeDb(feedback: any = { id: 'f1', followUpStatus: 'new' }) {
  return {
    invoiceFeedback: {
      findUnique: jest.fn(async ({ where }: any) =>
        feedback && where.id === feedback.id ? feedback : null,
      ),
      update: jest.fn(async ({ data }: any) => ({ ...feedback, ...data })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
  } as any;
}

describe('FeedbackService — V-79 followUpStatus enum', () => {
  const service = new FeedbackService();

  describe('updateFollowUp', () => {
    it.each(['new', 'reviewed', 'contacted'])(
      'accepts valid follow-up status %s',
      async (status) => {
        const db = makeDb();
        const res = await service.updateFollowUp(db, 'f1', status);
        expect(db.invoiceFeedback.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'f1' },
            data: { followUpStatus: status },
          }),
        );
        expect(res.followUpStatus).toBe(status);
      },
    );

    it('rejects a status outside the enum (never reaches update)', async () => {
      const db = makeDb();
      await expect(
        service.updateFollowUp(db, 'f1', 'archived'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(db.invoiceFeedback.update).not.toHaveBeenCalled();
    });

    it('rejects when the feedback does not exist', async () => {
      const db = makeDb(null);
      await expect(
        service.updateFollowUp(db, 'missing', 'new'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll — followUpStatus filter guard', () => {
    it('applies the filter for a valid enum value', async () => {
      const db = makeDb();
      await service.findAll(db, { followUpStatus: 'reviewed' });
      const arg = db.invoiceFeedback.findMany.mock.calls[0][0];
      expect(arg.where.followUpStatus).toBe('reviewed');
    });

    it('ignores an out-of-enum filter value (avoids a DB enum error → 500)', async () => {
      const db = makeDb();
      await service.findAll(db, { followUpStatus: 'garbage' });
      const arg = db.invoiceFeedback.findMany.mock.calls[0][0];
      expect(arg.where.followUpStatus).toBeUndefined();
    });
  });
});
