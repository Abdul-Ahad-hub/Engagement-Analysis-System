import { FrameDTO } from "src/dtos/FrameDTO";
import { EngagementResultDto } from "src/dtos/EngagementResultDto";

/**
 * Contract for the frames business logic. Controllers depend on this
 * interface, not on FramesService directly.
 */
export interface IFramesService {
  analyzeFrame(dto: FrameDTO): Promise<EngagementResultDto>;
  getResult(id: string): Promise<EngagementResultDto>;
}