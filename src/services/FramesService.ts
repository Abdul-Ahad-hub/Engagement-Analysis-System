import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  IFramesService,
  SessionReport,
  WindowAnalysisResponse,
} from '../interfaces/service/IFrameService';
import type { IFramesRepository } from '../interfaces/repository/IFramesRepository';
import type { IModelClient, ModelAcceptedResult, ModelPredictionResult, ModelUpload } from '../interfaces/service/IModelClient';
import type { ITemporaryStorageService } from '../interfaces/service/ITemporaryStorageService';
import { FrameDTO, FrameItemDto } from '../dtos/FrameDTO';
import { SessionSummaryDto } from '../dtos/SessionSummaryDto';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import { EngagementRecord } from '../entities/EngagementRecord';
import { EngagementSession } from '../entities/EngagementSession';
import { OnlyResultDto } from '../dtos/OnlyResultDto';
import { OnlyLandmarksDto } from '../dtos/OnlyLandmarksDto';
import { FrameValidationException, ModelInferenceException } from '../common/exceptions/Exceptions';
import {
  FRAMES_REPOSITORY,
  MODEL_CLIENT,
  TEMPORARY_STORAGE_SERVICE,
} from '../common/constants/injection-tokens';

interface ValidatedWindow {
  frames: FrameItemDto[];
  faceFrames: number;
  skipReason: 'too_few_frames' | 'too_few_faces' | null;
}

/**
 * Business logic layer. Knows nothing about HTTP, Redis, or the ORM —
 * only talks to the model client, temporary storage, and repository
 * through their interfaces, so it can be unit tested with simple mocks.
 *
 * Write path per window:
 *   validate -> idempotency check -> model inference (unless business rules
 *   skip it) -> buffer in temporary storage.
 * Nothing hits the permanent DB until flushSession() runs (count-window
 * trigger or explicit session-end signal).
 */
@Injectable()
export class FramesService implements IFramesService {
  private static readonly FRAMES_PER_WINDOW = 16;
  private static readonly FRAME_SIZE = 160;
  private static readonly LANDMARK_COUNT = 52;
  private static readonly MIN_FRAMES_FOR_INFERENCE = 8;
  private static readonly MIN_FACE_FRAMES_FOR_INFERENCE = 8;
  private static readonly FLUSH_EVERY_N_WINDOWS = 10;
  private static readonly SKIPPED_WINDOW_LABEL = 'no_face';
  private static readonly MAX_LISTED_SESSIONS = 200;

  private readonly logger = new Logger(FramesService.name);
  private readonly flushing = new Map<string, Promise<EngagementResultDto[]>>();

  constructor(
    @Inject(FRAMES_REPOSITORY)
    private readonly framesRepository: IFramesRepository,
    @Inject(MODEL_CLIENT)
    private readonly modelClient: IModelClient,
    @Inject(TEMPORARY_STORAGE_SERVICE)
    private readonly temporaryStorage: ITemporaryStorageService,
  ) {}

  async analyzeFrame(dto: FrameDTO): Promise<WindowAnalysisResponse> {
    const asyncMode = this.modelClient.isAsyncEnabled?.() === true;
    if (asyncMode) {
      const saved = await this.framesRepository.findBySessionWindow(dto.sessionId, dto.windowIndex);
      if (saved) return { ok: true, duplicate: true, result: this.toResultDto(saved) };
    }
    const existing = await this.temporaryStorage.getWindowResult(dto.sessionId, dto.windowIndex);
    if (existing) {
      this.logger.log(`window ${dto.windowIndex} of session ${dto.sessionId} already processed (retry)`);
      return { ok: true, duplicate: true, result: existing };
    }

    const v = this.validateWindow(dto);

    let engagementScore: number | null = null;
    let engagementLabel = FramesService.SKIPPED_WINDOW_LABEL;
    if (!v.skipReason) {
      const pending: Partial<EngagementRecord> = {
        id: randomUUID(), sessionId: dto.sessionId, meetingId: dto.meetingId ?? null,
        userEmail: dto.userEmail ?? null, userName: dto.userName ?? null, windowIndex: dto.windowIndex,
        engagementScore: null, engagementLabel: 'pending', status: 'pending', skipReason: null,
        framesFilled: dto.framesFilled, faceFrames: v.faceFrames, partial: dto.partial,
        startTime: new Date(dto.startedAt), endTime: new Date(dto.endedAt), source: 'cloud',
        resultId: null, prediction: null,
      };
      // The durable placeholder must exist before the AI can callback, since a fast
      // batch may finish before its HTTP 202 response reaches this process.
      if (asyncMode) await this.framesRepository.createMany([pending]);
      let prediction: ModelPredictionResult | ModelAcceptedResult;
      try {
        prediction = await this.modelClient.predict({
          frames: v.frames.map((f) => f.data),
          landmarks: dto.landmarks,
          faceDetected: dto.faceDetected,
          frameShape: [FramesService.FRAME_SIZE, FramesService.FRAME_SIZE, 3],
          landmarkIndices: dto.landmarkIndices,
          meta: {
            sessionId: dto.sessionId,
            meetingId: dto.meetingId ?? null,
            windowIndex: dto.windowIndex,
            userEmail: dto.userEmail ?? null,
            userName: dto.userName ?? null,
            userId: dto.userId ?? null,
            partial: dto.partial,
            framesFilled: dto.framesFilled,
            frameIntervalMs: dto.frameIntervalMs,
            startedAt: dto.startedAt,
            endedAt: dto.endedAt,
          },
        });
      } catch (err) {
        if (asyncMode) {
          await this.framesRepository.createMany([{
            ...pending,
            status: 'failed',
            engagementLabel: 'inference_error',
            skipReason: (err as Error).message,
          }]);
        }
        throw err;
      }
      if ('accepted' in prediction && prediction.accepted) {
        return {
          ok: true,
          duplicate: false,
          aiJobId: prediction.jobId,
          result: this.toResultDto({ ...pending, status: 'pending' } as EngagementRecord),
        };
      }
      const syncPrediction = prediction as ModelPredictionResult;
      engagementScore = syncPrediction.engagementScore;
      engagementLabel = syncPrediction.engagementLabel;
    }

    const result: EngagementResultDto = {
      id: randomUUID(),
      sessionId: dto.sessionId,
      meetingId: dto.meetingId ?? null,
      userEmail: dto.userEmail ?? null,
      userName: dto.userName ?? null,
      windowIndex: dto.windowIndex,
      engagementScore,
      engagementLabel,
      status: v.skipReason ? 'skipped' : 'inferred',
      skipReason: v.skipReason,
      framesFilled: dto.framesFilled,
      faceFrames: v.faceFrames,
      partial: dto.partial,
      startTime: dto.startedAt,
      endTime: dto.endedAt,
    };

    if (asyncMode && !v.skipReason) await this.storeInDatabase([result]);
    else await this.temporaryStorage.saveRecord(result);
    this.logger.log(
      `session ${dto.sessionId} window ${dto.windowIndex}: ${result.status}` +
        (v.skipReason ? ` (${v.skipReason})` : ` -> ${engagementLabel} (${engagementScore})`) +
        ` faces ${v.faceFrames}/${dto.faceDetected.length}, avgFrameMs ${dto.timing.avgFrameMs}`,
    );

    const buffered = await this.temporaryStorage.countRecords(dto.sessionId);
    if (buffered >= FramesService.FLUSH_EVERY_N_WINDOWS) {
      this.flushSession(dto.sessionId).catch((err) =>
        this.logger.error(`background flush failed for ${dto.sessionId}: ${(err as Error).message}`),
      );
    }

    return { ok: true, duplicate: false, result };
  }

  async handleAiResult(entry: Record<string, unknown>): Promise<void> {
    const sessionId = String(entry.sessionId ?? '');
    const windowIndex = Number(entry.windowIndex);
    if (!sessionId || !Number.isInteger(windowIndex) || windowIndex < 0) {
      throw new FrameValidationException({ cause: 'AI callback requires sessionId and windowIndex' });
    }
    const existing = await this.framesRepository.findBySessionWindow(sessionId, windowIndex);
    const failed = typeof entry.error === 'string';
    const score = Number(entry.confidence);
    const label = entry.engagement_Level;
    const record: Partial<EngagementRecord> = {
      id: existing?.id ?? randomUUID(), sessionId, windowIndex,
      meetingId: String(entry.meetingId ?? existing?.meetingId ?? '') || null,
      userEmail: String(entry.userEmail ?? existing?.userEmail ?? '') || null,
      userName: String(entry.userName ?? existing?.userName ?? '') || null,
      engagementScore: failed || !Number.isFinite(score) ? null : score,
      engagementLabel: failed ? 'inference_error' : String(label ?? 'unknown'),
      status: failed ? 'failed' : 'inferred', skipReason: failed ? String(entry.error) : null,
      framesFilled: Number(entry.framesFilled ?? existing?.framesFilled ?? 0),
      faceFrames: existing?.faceFrames ?? 0,
      partial: Boolean(entry.partial ?? existing?.partial ?? false),
      startTime: new Date(String(entry.startedAt ?? existing?.startTime ?? new Date().toISOString())),
      endTime: new Date(String(entry.endedAt ?? existing?.endTime ?? new Date().toISOString())),
      source: 'cloud', resultId: null, prediction: { raw: entry, aiJobId: entry.job_id ?? null },
    };
    await this.framesRepository.createMany([record]);
  }

  private toResultDto(record: EngagementRecord): EngagementResultDto {
    return {
      id: record.id, sessionId: record.sessionId, meetingId: record.meetingId,
      userEmail: record.userEmail, userName: record.userName, windowIndex: record.windowIndex,
      engagementScore: record.engagementScore, engagementLabel: record.engagementLabel,
      status: record.status as EngagementResultDto['status'], skipReason: record.skipReason,
      framesFilled: record.framesFilled, faceFrames: record.faceFrames, partial: record.partial,
      startTime: record.startTime.toISOString(), endTime: record.endTime.toISOString(),
    };
  }

  async saveSession(dto: SessionSummaryDto): Promise<EngagementSession> {
    await this.flushSession(dto.sessionId);
    const records = await this.framesRepository.findBySessionId(dto.sessionId);
    const inferred = records.filter((r) => r.status === 'inferred');
    const scored = inferred.filter((r) => typeof r.engagementScore === 'number');

    const labelCounts = new Map<string, number>();
    for (const r of inferred) {
      labelCounts.set(r.engagementLabel, (labelCounts.get(r.engagementLabel) ?? 0) + 1);
    }
    const dominantLabel = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const session = await this.framesRepository.upsertSession({
      sessionId: dto.sessionId,
      meetingId: dto.meetingId ?? null,
      userEmail: dto.userEmail ?? null,
      userName: dto.userName ?? null,
      userId: dto.userId ?? null,
      role: dto.role ?? null,
      endReason: dto.endReason ?? null,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : (records[0]?.startTime ?? null),
      savedAt: new Date(dto.savedAt),
      framesCaptured: dto.framesCaptured,
      framesWithFace: dto.framesWithFace,
      framesCenterCrop: dto.framesCenterCrop,
      avgFrameMs: dto.avgFrameMs,
      maxFrameMs: dto.maxFrameMs,
      windowsSent: dto.windowsSent,
      windowsUnsent: dto.windowsUnsent,
      mode: dto.mode ?? null,
      routing: dto.routing ?? null,
      windowsStored: records.length,
      windowsInferred: inferred.length,
      avgEngagementScore: scored.length
        ? Math.round(
            (scored.reduce((s, r) => s + (r.engagementScore as number), 0) / scored.length) * 1000,
          ) / 1000
        : null,
      dominantLabel,
    });
    this.logger.log(
      `session ${dto.sessionId} saved: ${records.length} windows stored, ${inferred.length} inferred, ` +
        `avg score ${session.avgEngagementScore}, ${dto.windowsUnsent} unsent`,
    );
    return session;
  }

  async saveOnlyResult(dto: OnlyResultDto) {
    const existing = await this.framesRepository.findBySessionWindow(dto.sessionId, dto.windowIndex);
    if (existing) return { ok: true, duplicate: true, record: existing };
    const record: Partial<EngagementRecord> = {
      id: randomUUID(), sessionId: dto.sessionId, meetingId: dto.meetingId ?? null,
      userEmail: dto.userEmail ?? null, userName: dto.userName ?? null, windowIndex: dto.windowIndex,
      engagementScore: dto.confidence, engagementLabel: dto.label, status: 'inferred',
      skipReason: null, framesFilled: dto.framesInWindow, faceFrames: dto.faceFrames,
      partial: dto.partial, startTime: new Date(dto.startedAt), endTime: new Date(dto.at),
      source: 'local', resultId: dto.resultId,
      prediction: { ...dto, userId: dto.userId ?? null },
    };
    await this.framesRepository.createMany([record]);
    return { ok: true, duplicate: false };
  }

  async analyzeOnlyLandmarks(dto: OnlyLandmarksDto) {
    const existing = await this.framesRepository.findBySessionWindow(dto.sessionId, dto.windowIndex);
    if (existing) return { ok: true, duplicate: true, record: existing };
    const problems: string[] = [];
    if (dto.landmarkCount !== 52 || dto.landmarkIndices.length !== 52) problems.push('landmarkCount and landmarkIndices must contain 52 landmarks');
    if (dto.landmarks.length !== 16 || dto.faceDetected.length !== 16) problems.push('landmarks and faceDetected must contain 16 frames');
    dto.landmarks.forEach((points, i) => {
      if (points.length !== 52 || points.some((p) => p.length !== 3 || p.some((v) => !Number.isFinite(v)))) problems.push(`landmarks[${i}] must be [52][3] finite numbers`);
      if (dto.faceDetected[i] === false && points.some((p) => p[0] !== 0 || p[1] !== 0 || p[2] !== 0)) problems.push(`landmarks[${i}] must be zero when face is absent`);
    });
    if (Date.parse(dto.endedAt) < Date.parse(dto.startedAt)) problems.push('endedAt is before startedAt');
    if (problems.length) throw new FrameValidationException({ problems });
    if (!this.modelClient.predictLandmarks) throw new ModelInferenceException({ cause: 'Landmarks-only model is not configured' });
    const prediction = await this.modelClient.predictLandmarks({
      landmarks: dto.landmarks, faceDetected: dto.faceDetected, landmarkIndices: dto.landmarkIndices,
      meta: { sessionId: dto.sessionId, meetingId: dto.meetingId ?? null, windowIndex: dto.windowIndex,
        userEmail: dto.userEmail ?? null, partial: dto.partial, framesFilled: dto.framesFilled,
        frameIntervalMs: dto.frameIntervalMs, startedAt: dto.startedAt, endedAt: dto.endedAt },
    });
    const record: Partial<EngagementRecord> = {
      id: randomUUID(), sessionId: dto.sessionId, meetingId: dto.meetingId ?? null,
      userEmail: dto.userEmail ?? null, userName: dto.userName ?? null, windowIndex: dto.windowIndex,
      engagementScore: prediction.engagementScore, engagementLabel: prediction.engagementLabel,
      status: 'inferred', skipReason: null, framesFilled: dto.framesFilled,
      faceFrames: dto.faceDetected.filter(Boolean).length, partial: dto.partial,
      startTime: new Date(dto.startedAt), endTime: new Date(dto.endedAt), source: 'landmarks',
      resultId: null, prediction: { raw: prediction.raw, reason: dto.reason ?? null },
    };
    await this.framesRepository.createMany([record]);
    return { ok: true, duplicate: false, result: record };
  }

  async analyzeVideo(video: ModelUpload, meta: Record<string, unknown>): Promise<ModelPredictionResult> {
    if (!this.modelClient.predictVideo) throw new ModelInferenceException({ cause: 'Video model route is not configured' });
    return this.modelClient.predictVideo(video, meta);
  }

  async analyzeVideoLandmarks(
    video: ModelUpload,
    landmarks: ModelUpload,
    meta: Record<string, unknown>,
  ): Promise<ModelPredictionResult> {
    if (!this.modelClient.predictVideoLandmarks) throw new ModelInferenceException({ cause: 'Video-landmarks model route is not configured' });
    return this.modelClient.predictVideoLandmarks(video, landmarks, meta);
  }

  async flushSession(sessionId: string): Promise<EngagementResultDto[]> {
    while (this.flushing.has(sessionId)) {
      await this.flushing.get(sessionId)!.catch(() => undefined);
    }

    const job = this.doFlush(sessionId).finally(() => this.flushing.delete(sessionId));
    this.flushing.set(sessionId, job);
    return job;
  }

  async listUserSessions(userEmail: string): Promise<EngagementSession[]> {
    return this.framesRepository.findSessionsByUserEmail(
      userEmail,
      FramesService.MAX_LISTED_SESSIONS,
    );
  }

  async getUserSessionReport(
    sessionId: string,
    userEmail: string,
  ): Promise<SessionReport | null> {
    const report = await this.getSessionReport(sessionId);
    const owner = report.session?.userEmail?.toLowerCase();
    return owner && owner === userEmail.toLowerCase() ? report : null;
  }

  async getSessionReport(sessionId: string): Promise<SessionReport> {
    const [session, records] = await Promise.all([
      this.framesRepository.findSession(sessionId),
      this.framesRepository.findBySessionId(sessionId),
    ]);
    return { session, records };
  }

  private async doFlush(sessionId: string): Promise<EngagementResultDto[]> {
    const buffered = await this.temporaryStorage.getRecords(sessionId);

    if (buffered.length === 0) {
      return [];
    }

    await this.storeInDatabase(buffered);
    await this.temporaryStorage.clearRecords(sessionId, buffered.length);

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
      sessionId: r.sessionId,
      meetingId: r.meetingId,
      userEmail: r.userEmail,
      userName: r.userName,
      windowIndex: r.windowIndex,
      engagementScore: r.engagementScore,
      engagementLabel: r.engagementLabel,
      status: r.status,
      skipReason: r.skipReason,
      framesFilled: r.framesFilled,
      faceFrames: r.faceFrames,
      partial: r.partial,
      startTime: new Date(r.startTime),
      endTime: new Date(r.endTime),
    }));

    await this.framesRepository.createMany(entities);
  }

  /**
   * Domain validation and business rules for a 16-frame capture window.
   */
  private validateWindow(dto: FrameDTO): ValidatedWindow {
    const N = FramesService.FRAMES_PER_WINDOW;
    const S = FramesService.FRAME_SIZE;
    const L = FramesService.LANDMARK_COUNT;
    const frameBytes = S * S * 3;
    const problems: string[] = [];

    if (!dto.partial && dto.framesFilled !== N) {
      problems.push(`framesFilled must be ${N} for a complete window (got ${dto.framesFilled})`);
    }
    if (dto.framesFilled > N) problems.push(`framesFilled ${dto.framesFilled} > ${N}`);
    if (Date.parse(dto.endedAt) < Date.parse(dto.startedAt)) {
      problems.push('endedAt is before startedAt');
    }

    for (const [name, arr] of [
      ['frames', dto.frames],
      ['landmarks', dto.landmarks],
      ['faceDetected', dto.faceDetected],
    ] as const) {
      if (arr.length !== N) problems.push(`${name} must have ${N} entries (got ${arr.length})`);
    }

    if (dto.landmarkCount !== L) {
      problems.push(`landmarkCount must be ${L} (got ${dto.landmarkCount})`);
    }
    if (dto.landmarkIndices.length !== dto.landmarkCount) {
      problems.push(
        `landmarkIndices has ${dto.landmarkIndices.length} entries, landmarkCount says ${dto.landmarkCount}`,
      );
    }

    const frames = [...dto.frames].sort((a, b) => a.index - b.index);
    frames.forEach((f, k) => {
      if (f.index !== k) {
        problems.push(
          `frame indices must be 0..${N - 1} without gaps/duplicates (position ${k} has index ${f.index})`,
        );
      }
      if (f.shape[0] !== S || f.shape[1] !== S || f.shape[2] !== 3) {
        problems.push(`frame ${f.index}: shape must be [${S},${S},3] (got [${f.shape.join(',')}])`);
      }
      const bytes = Buffer.byteLength(f.data, 'base64');
      if (bytes !== frameBytes) {
        problems.push(`frame ${f.index}: decodes to ${bytes} bytes, expected ${frameBytes}`);
      }
      if (dto.faceDetected[f.index] !== undefined && dto.faceDetected[f.index] !== f.faceDetected) {
        problems.push(`frame ${f.index}: faceDetected disagrees with window.faceDetected[${f.index}]`);
      }
      if (f.faceDetected && f.cropBox?.source !== 'face') {
        problems.push(
          `frame ${f.index}: faceDetected=true but cropBox.source is ${f.cropBox?.source ?? 'null'}`,
        );
      }
    });

    dto.landmarks.forEach((frameLm, k) => {
      if (!Array.isArray(frameLm) || frameLm.length !== L) {
        problems.push(`landmarks[${k}] must have ${L} points`);
        return;
      }
      for (const p of frameLm) {
        if (
          !Array.isArray(p) ||
          p.length !== 3 ||
          !p.every((v) => typeof v === 'number' && Number.isFinite(v))
        ) {
          problems.push(`landmarks[${k}] contains a point that is not [x, y, z] numbers`);
          return;
        }
      }
      if (
        dto.faceDetected[k] === false &&
        frameLm.some((p) => p[0] !== 0 || p[1] !== 0 || p[2] !== 0)
      ) {
        problems.push(`landmarks[${k}] must be all zeros because faceDetected[${k}] is false`);
      }
    });

    if (problems.length > 0) {
      throw new FrameValidationException({
        sessionId: dto.sessionId,
        windowIndex: dto.windowIndex,
        problems: problems.slice(0, 25),
        problemCount: problems.length,
      });
    }

    const faceFrames = dto.faceDetected.filter(Boolean).length;
    const imageFrames = frames.filter((f) => f.cropBox !== null && f.cropBox !== undefined).length;
    let skipReason: ValidatedWindow['skipReason'] = null;
    if (imageFrames < FramesService.MIN_FRAMES_FOR_INFERENCE) skipReason = 'too_few_frames';
    else if (faceFrames < FramesService.MIN_FACE_FRAMES_FOR_INFERENCE) skipReason = 'too_few_faces';

    return { frames, faceFrames, skipReason };
  }
}
