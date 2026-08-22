import { Module } from '@nestjs/common';
import { redisClientProvider } from '../external-services/redisClientProvider';
import { RedisTemporaryStorageService } from '../services/RedisTemporaryStorageService';
import { TEMPORARY_STORAGE_SERVICE } from '../common/constants/injection-tokens';

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
export class RedisModule {}
