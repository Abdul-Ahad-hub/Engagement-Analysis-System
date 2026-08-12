import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ITemporaryStorageService } from '../interfaces/service/ITemporaryStorageService';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import { REDIS_CLIENT } from '../common/constants/injection-tokens';
import { TemporaryStorageException } from '../common/exceptions/Exceptions';
/**
 * Redis-backed buffer: one list per session, keyed as
 * "engagement:buffer:{sessionId}", holding JSON-serialized
 * EngagementResultDto entries in insertion order (RPUSH/LRANGE).
 *
 * A TTL is set on the key so an abandoned session (never explicitly
 * flushed/ended) doesn't leak memory in Redis forever.
 */
@Injectable()
export class RedisTemporaryStorageService implements ITemporaryStorageService {
  /** Safety-net expiry for a session's buffer if it's never explicitly cleared. */
  private static readonly BUFFER_TTL_SECONDS = 60 * 60 * 6; // 6 hours

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(sessionId: string): string {
    return `engagement:buffer:${sessionId}`;
  }

  async saveRecord(record: EngagementResultDto): Promise<void> {
    try {
      const key = this.key(record.sessionId);
      await this.redis
        .multi()
        .rpush(key, JSON.stringify(record))
        .expire(key, RedisTemporaryStorageService.BUFFER_TTL_SECONDS)
        .exec();
    } catch (err) {
      throw new TemporaryStorageException({
        operation: 'saveRecord',
        cause: (err as Error).message,
      });
    }
  }

  async getRecords(sessionId: string): Promise<EngagementResultDto[]> {
    try {
      const raw = await this.redis.lrange(this.key(sessionId), 0, -1);
      return raw.map((entry) => JSON.parse(entry) as EngagementResultDto);
    } catch (err) {
      throw new TemporaryStorageException({
        operation: 'getRecords',
        cause: (err as Error).message,
      });
    }
  }

  async countRecords(sessionId: string): Promise<number> {
    try {
      return await this.redis.llen(this.key(sessionId));
    } catch (err) {
      throw new TemporaryStorageException({
        operation: 'countRecords',
        cause: (err as Error).message,
      });
    }
  }

  async clearRecords(sessionId: string): Promise<void> {
    try {
      await this.redis.del(this.key(sessionId));
    } catch (err) {
      throw new TemporaryStorageException({
        operation: 'clearRecords',
        cause: (err as Error).message,
      });
    }
  }
}