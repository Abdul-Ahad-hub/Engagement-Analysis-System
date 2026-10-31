import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ITemporaryStorageService } from '../interfaces/service/ITemporaryStorageService';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import { REDIS_CLIENT } from '../common/constants/injection-tokens';

/**
 * Redis-backed buffer: one list per session, keyed as
 * "engagement:buffer:{sessionId}", holding JSON-serialized
 * EngagementResultDto entries in insertion order (RPUSH/LRANGE).
 *
 * If Redis is not running locally during development, operations transparently
 * fall back to an in-memory Map so the backend still works out-of-the-box.
 */
@Injectable()
export class RedisTemporaryStorageService implements ITemporaryStorageService {
  private static readonly BUFFER_TTL_SECONDS = 60 * 60 * 6; // 6 hours
  private readonly logger = new Logger(RedisTemporaryStorageService.name);

  // In-memory fallback used automatically whenever Redis is unreachable.
  private readonly memBuffers = new Map<string, EngagementResultDto[]>();
  private readonly memWindows = new Map<string, Map<number, EngagementResultDto>>();
  private warnedFallback = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(sessionId: string): string {
    return `engagement:buffer:${sessionId}`;
  }

  private windowsKey(sessionId: string): string {
    return `engagement:windows:${sessionId}`;
  }

  private warnOnce(err: unknown) {
    if (!this.warnedFallback) {
      this.warnedFallback = true;
      this.logger.warn(
        `Redis unreachable (${(err as Error).message}); falling back to in-memory session buffer.`,
      );
    }
  }

  async saveRecord(record: EngagementResultDto): Promise<void> {
    try {
      const key = this.key(record.sessionId);
      const wkey = this.windowsKey(record.sessionId);
      const json = JSON.stringify(record);
      await this.redis
        .multi()
        .rpush(key, json)
        .expire(key, RedisTemporaryStorageService.BUFFER_TTL_SECONDS)
        .hset(wkey, String(record.windowIndex), json)
        .expire(wkey, RedisTemporaryStorageService.BUFFER_TTL_SECONDS)
        .exec();
    } catch (err) {
      this.warnOnce(err);
      const list = this.memBuffers.get(record.sessionId) ?? [];
      list.push(record);
      this.memBuffers.set(record.sessionId, list);
      const w = this.memWindows.get(record.sessionId) ?? new Map<number, EngagementResultDto>();
      w.set(record.windowIndex, record);
      this.memWindows.set(record.sessionId, w);
    }
  }

  async getRecords(sessionId: string): Promise<EngagementResultDto[]> {
    try {
      const raw = await this.redis.lrange(this.key(sessionId), 0, -1);
      return raw.map((entry) => JSON.parse(entry) as EngagementResultDto);
    } catch (err) {
      this.warnOnce(err);
      return [...(this.memBuffers.get(sessionId) ?? [])];
    }
  }

  async countRecords(sessionId: string): Promise<number> {
    try {
      return await this.redis.llen(this.key(sessionId));
    } catch (err) {
      this.warnOnce(err);
      return this.memBuffers.get(sessionId)?.length ?? 0;
    }
  }

  async clearRecords(sessionId: string, count?: number): Promise<void> {
    try {
      if (count === undefined) {
        await this.redis.del(this.key(sessionId));
      } else if (count > 0) {
        await this.redis.ltrim(this.key(sessionId), count, -1);
      }
    } catch (err) {
      this.warnOnce(err);
      if (count === undefined) {
        this.memBuffers.delete(sessionId);
      } else {
        this.memBuffers.get(sessionId)?.splice(0, count);
      }
    }
  }

  async getWindowResult(sessionId: string, windowIndex: number): Promise<EngagementResultDto | null> {
    try {
      const raw = await this.redis.hget(this.windowsKey(sessionId), String(windowIndex));
      return raw ? (JSON.parse(raw) as EngagementResultDto) : null;
    } catch (err) {
      this.warnOnce(err);
      return this.memWindows.get(sessionId)?.get(windowIndex) ?? null;
    }
  }
}
