import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve((req as { ip?: string }).ip ?? 'unknown');
  }
}
