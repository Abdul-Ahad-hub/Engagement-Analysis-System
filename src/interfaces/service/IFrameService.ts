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
}
