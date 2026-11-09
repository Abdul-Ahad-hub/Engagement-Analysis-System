import { EngagementRecord } from '../../entities/EngagementRecord';
import { EngagementSession } from '../../entities/EngagementSession';

/**
 * Contract for persistence. The service layer depends only on this
 * interface, never on the concrete TypeORM repository - so the storage
 * engine can change (or be mocked in tests) without touching business logic.
 */
export interface IFramesRepository {
  /** Insert-or-update by (sessionId, windowIndex), so re-flushing is safe. */
  createMany(records: Partial<EngagementRecord>[]): Promise<void>;
  findById(id: string): Promise<EngagementRecord | null>;
  findBySessionWindow(sessionId: string, windowIndex: number): Promise<EngagementRecord | null>;
  findBySessionId(sessionId: string): Promise<EngagementRecord[]>;

  upsertSession(session: Partial<EngagementSession>): Promise<EngagementSession>;
  findSession(sessionId: string): Promise<EngagementSession | null>;
  /** Newest-first sessions saved by one user (matched on verified e-mail). */
  findSessionsByUserEmail(userEmail: string, limit: number): Promise<EngagementSession[]>;
}
