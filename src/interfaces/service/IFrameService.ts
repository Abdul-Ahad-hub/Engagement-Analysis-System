import { FrameDTO } from '../../dtos/FrameDTO';
import { SessionSummaryDto } from '../../dtos/SessionSummaryDto';
import { EngagementResultDto } from '../../dtos/EngagementResultDto';
import { EngagementSession } from '../../entities/EngagementSession';
import { EngagementRecord } from '../../entities/EngagementRecord';
import { OnlyResultDto } from '../../dtos/OnlyResultDto';
import { OnlyLandmarksDto } from '../../dtos/OnlyLandmarksDto';
import { ModelPredictionResult, ModelUpload } from './IModelClient';

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
  saveOnlyResult(dto: OnlyResultDto): Promise<unknown>;
  analyzeOnlyLandmarks(dto: OnlyLandmarksDto): Promise<unknown>;
  analyzeVideo(video: ModelUpload, meta: Record<string, unknown>): Promise<ModelPredictionResult>;
  analyzeVideoLandmarks(
    video: ModelUpload,
    landmarks: ModelUpload,
    meta: Record<string, unknown>,
  ): Promise<ModelPredictionResult>;
  flushSession(sessionId: string): Promise<EngagementResultDto[]>;
  getSessionReport(sessionId: string): Promise<SessionReport>;
}
