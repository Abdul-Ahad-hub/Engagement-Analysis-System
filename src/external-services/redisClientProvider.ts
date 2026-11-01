import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from '../common/constants/injection-tokens';

/**
 * Provides a single shared ioredis client, configured from environment
 * variables. Prefers REDIS_URL (e.g. Upstash rediss://...) and falls back to
 * REDIS_HOST / REDIS_PORT / REDIS_PASSWORD. Uses lazyConnect + retryStrategy: null
 * so serverless deployments without Redis fail gracefully to the in-memory
 * buffer in RedisTemporaryStorageService instead of crashing at boot.
 */
export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const commonOptions: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    };

    const redisUrl = configService.get<string>('REDIS_URL')?.trim();
    const client = redisUrl
      ? new Redis(redisUrl, commonOptions)
      : new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get('REDIS_PORT') ?? 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          ...commonOptions,
        });

    client.on('error', () => {
      /* handled gracefully by RedisTemporaryStorageService fallback */
    });
    return client;
  },
  inject: [ConfigService],
};
