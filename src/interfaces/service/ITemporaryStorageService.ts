import { EngagementResultDto } from '../../dtos/EngagementResultDto';

/**
 * Contract for short-lived buffer storage used between window-by-window
 * inference and the periodic/end-of-session flush to the permanent DB.
 * Callers (e.g. FramesService) depend only on this interface - they have
 * no idea whether it's backed by Redis, in-memory, or anything else.
 */
export interface ITemporaryStorageService {
  /** Append one result to the buffer for a session (and remember it by windowIndex). */
  saveRecord(record: EngagementResultDto): Promise<void>;

  /** Retrieve all buffered results for a session, in insertion order. */
  getRecords(sessionId: string): Promise<EngagementResultDto[]>;

  /** Current number of buffered results for a session (for count-based flush triggers). */
  countRecords(sessionId: string): Promise<number>;

  /**
   * Remove flushed results. With `count`, only the first `count` entries are
   * removed, so results appended during a flush are not lost.
   */
  clearRecords(sessionId: string, count?: number): Promise<void>;

  /**
   * Result already produced for (sessionId, windowIndex), if any. Used to make
   * window uploads idempotent: the extension retries on network errors, and a
   * retried window must not run the model or be stored twice.
   */
  getWindowResult(sessionId: string, windowIndex: number): Promise<EngagementResultDto | null>;
}
