import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IFramesService } from '../interfaces/service/IFrameService';
import type { IFramesRepository } from '../interfaces/repository/IFramesRepository';
import type { IModelClient } from '../interfaces/service/IModelClient';
import type { ITemporaryStorageService } from '../interfaces/service/ITemporaryStorageService';
import { FrameDTO } from '../dtos/FrameDTO';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import { EngagementRecord } from '../entities/EngagementRecord';
import {
  FRAMES_REPOSITORY,
  MODEL_CLIENT,
  TEMPORARY_STORAGE_SERVICE,
} from '../common/constants/injection-tokens';

/**
 * Business logic layer. Knows nothing about HTTP, Redis, or the ORM —
 * only talks to the model client, temporary storage, and repository
 * through their interfaces, so it can be unit tested with simple mocks.
 *
 * Write path per clip: model inference -> buffer in temporary storage.
 * Nothing hits the permanent DB until flushSession() runs (count-window
 * trigger from the caller, or an explicit meeting-end signal).
 */
@Injectable()
export class FramesService implements IFramesService {
  private readonly logger = new Logger(FramesService.name);

  constructor(
    @Inject(FRAMES_REPOSITORY)
    private readonly framesRepository: IFramesRepository,
    @Inject(MODEL_CLIENT)
    private readonly modelClient: IModelClient,
    @Inject(TEMPORARY_STORAGE_SERVICE)
    private readonly temporaryStorage: ITemporaryStorageService,
  ) {}

  async analyzeFrame(dto: FrameDTO): Promise<EngagementResultDto> {
    const prediction = await this.modelClient.predict(dto.data, dto.sequence);

    const result: EngagementResultDto = {
      id: randomUUID(),
      userId: dto.userId,
      sessionId: dto.sessionId,
      engagementScore: prediction.engagementScore,
      engagementLabel: prediction.engagementLabel,
      startTime: dto.startTime,
      endTime: dto.endTime,
    };

    await this.temporaryStorage.saveRecord(result);
    return result;
  }

  async flushSession(sessionId: string): Promise<EngagementResultDto[]> {
    const buffered = await this.temporaryStorage.getRecords(sessionId);

    if (buffered.length === 0) {
      return [];
    }

    await this.storeInDatabase(buffered);
    await this.temporaryStorage.clearRecords(sessionId);

    this.logger.log(`Flushed ${buffered.length} records for session ${sessionId}`);
    return buffered;
  }

  /**
   * Maps buffered DTOs to entity shape and persists them in one bulk write.
   * Kept separate from flushSession so the DTO->entity mapping is isolated
   * and independently testable, and so flushSession stays readable as
   * pure orchestration (fetch -> persist -> clear).
   */
  private async storeInDatabase(records: EngagementResultDto[]): Promise<void> {
    const entities: Partial<EngagementRecord>[] = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      sessionId: r.sessionId,
      engagementScore: r.engagementScore,
      engagementLabel: r.engagementLabel,
      startTime: new Date(r.startTime),
      endTime: new Date(r.endTime),
    }));

    await this.framesRepository.createMany(entities);
  }
}