import { EngagementResultDto } from "src/dtos/EngagementResultDto";

/**
 * Contract for short-lived buffer storage used between frame-by-frame
 * inference and the periodic/end-of-session flush to the permanent DB.
 * Callers (e.g. FramesService) depend only on this interface — they have
 * no idea whether it's backed by Redis, in-memory, or anything else.
 */
export interface ITemporaryStorageService {
  /** Append one result to the buffer for a session. */
  saveRecord(record: EngagementResultDto): Promise<void>;

  /** Retrieve all buffered results for a session, in insertion order. */
  getRecords(sessionId: string): Promise<EngagementResultDto[]>;

  /** Current number of buffered results for a session (for count-based flush triggers). */
  countRecords(sessionId: string): Promise<number>;

  /** Clear a session's buffer — call after a successful flush to the permanent DB. */
  clearRecords(sessionId: string): Promise<void>;
}