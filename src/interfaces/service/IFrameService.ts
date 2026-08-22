import { FrameDTO } from 'src/dtos/FrameDTO';
import { EngagementResultDto } from 'src/dtos/EngagementResultDto';

export interface IFramesService {
  analyzeFrame(dto: FrameDTO): Promise<EngagementResultDto>;
  flushSession(sessionId: string): Promise<EngagementResultDto[]>;
}