import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

@Processor('notifications', { concurrency: 5 })
export class FailedJobsListener extends WorkerHost {
  private readonly logger = new Logger(FailedJobsListener.name);

  constructor(
    @InjectQueue('dead-letter') private readonly dlqQueue: Queue,
  ) {
    super();
  }

  // Required by WorkerHost — delegate to the notification processor
  async process(_job: Job): Promise<void> {
    // This processor only handles DLQ logic via events
    // Actual notification processing is in NotificationProcessor
    return;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    const maxAttempts = (job.opts?.attempts as number) || 4;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `🔴 JOB PERMANENTLY FAILED: ${job.name} [${job.id}] after ${job.attemptsMade} attempts`,
        {
          queue: job.queueName,
          data: job.data,
          error: error.message,
          stack: error.stack,
        },
      );

      // Move to DLQ for inspection/retry
      try {
        await this.dlqQueue.add('failed-job', {
          originalQueue: job.queueName,
          originalJobName: job.name,
          originalJobId: job.id,
          originalData: job.data,
          error: error.message,
          attempts: job.attemptsMade,
          failedAt: new Date().toISOString(),
        });
      } catch (dlqError) {
        this.logger.error(
          `Failed to move job ${job.id} to DLQ: ${(dlqError as Error).message}`,
        );
      }
    }
  }
}
