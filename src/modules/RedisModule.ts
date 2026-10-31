import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { redisClientProvider } from '../external-services/redisClientProvider';
import { RedisTemporaryStorageService } from '../services/RedisTemporaryStorageService';
import { REDIS_CLIENT, TEMPORARY_STORAGE_SERVICE } from '../common/constants/injection-tokens';

/**
 * Self-contained buffer-storage module. Exports only the interface token —
 * consumers (like FramesModule) never see RedisTemporaryStorageService or
 * the raw Redis client directly.
 */
@Module({
  providers: [
    redisClientProvider,
    { provide: TEMPORARY_STORAGE_SERVICE, useClass: RedisTemporaryStorageService },
  ],
  exports: [TEMPORARY_STORAGE_SERVICE],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    this.redis.disconnect();
  }
}
