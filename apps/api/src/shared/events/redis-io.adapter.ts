import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(): Promise<void> {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || '6379';
    const redisPassword = process.env.REDIS_PASSWORD || '';
    const redisUrl =
      process.env.REDIS_URL ||
      (redisPassword
        ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
        : `redis://${redisHost}:${redisPort}`);

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) =>
        this.logger.warn(`Redis pub client error: ${err.message}`),
      );
      subClient.on('error', (err) =>
        this.logger.warn(`Redis sub client error: ${err.message}`),
      );

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Redis IO adapter connected successfully');
    } catch (err) {
      this.logger.warn(
        `Failed to connect Redis IO adapter, falling back to in-memory: ${(err as Error).message}`,
      );
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
