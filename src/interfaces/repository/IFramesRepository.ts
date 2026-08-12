import { EngagementRecord } from '../entities/engagement-record.entity';

/**
 * Contract for persistence. The service layer depends only on this
 * interface, never on the concrete TypeORM repository — so the storage
 * engine can change (or be mocked in tests) without touching business logic.
 */
export interface IFramesRepository {
  createMany(records: Partial<EngagementRecord>[]): Promise<EngagementRecord[]>;
  findById(id: string): Promise<EngagementRecord | null>;
  findBySessionId(sessionId: string): Promise<EngagementRecord[]>;
}