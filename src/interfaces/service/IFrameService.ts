import { FrameDTO } from '../../dtos/FrameDTO';
import { SessionSummaryDto } from '../../dtos/SessionSummaryDto';
import { EngagementResultDto } from '../../dtos/EngagementResultDto';
import { EngagementSession } from '../../entities/EngagementSession';
import { EngagementRecord } from '../../entities/EngagementRecord';

export interface WindowAnalysisResponse {
  ok: true;
  /** true when this (sessionId, windowIndex) was already processed (retry). */
  duplicate: boolean;
  result: EngagementResultDto;
}

export interface SessionReport {
  session: EngagementSession | null;
  records: EngagementRecord[];
}

export interface IFramesService {
  analyzeFrame(dto: FrameDTO): Promise<WindowAnalysisResponse>;
  saveSession(dto: SessionSummaryDto): Promise<EngagementSession>;
  flushSession(sessionId: string): Promise<EngagementResultDto[]>;
  getSessionReport(sessionId: string): Promise<SessionReport>;
  /** Sessions owned by the given (verified) e-mail, newest first. */
  listUserSessions(userEmail: string): Promise<EngagementSession[]>;
  /** Full report of a session, only if it belongs to the given e-mail; otherwise null. */
  getUserSessionReport(sessionId: string, userEmail: string): Promise<SessionReport | null>;
}
