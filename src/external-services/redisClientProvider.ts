import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/constants/injection-tokens';

/**
 * Provides a single shared ioredis client, configured from environment
 * variables. Kept as its own provider (rather than instantiated inline in
 * the storage service) so any other module that eventually needs Redis
 * can reuse the same connection via the REDIS_CLIENT token.
 */
export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    return new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      // Fail fast on connection issues instead of buffering commands forever.
      maxRetriesPerRequest: 3,
    });
  },
  inject: [ConfigService],
};