import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/constants/injection-tokens';

/**
 * Provides a single shared ioredis client, configured from environment
 * variables. Uses lazyConnect + retryStrategy: null when unreachable so local
 * dev without a Redis server immediately falls back in RedisTemporaryStorageService.
 */
export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const client = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: Number(configService.get('REDIS_PORT') ?? 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on('error', () => {
      /* handled by RedisTemporaryStorageService fallback */
    });
    return client;
  },
  inject: [ConfigService],
};
