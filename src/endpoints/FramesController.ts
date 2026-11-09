import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  Req,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { FRAMES_SERVICE } from '../common/constants/injection-tokens';
import { FrameDTO } from '../dtos/FrameDTO';
import { SessionSummaryDto } from '../dtos/SessionSummaryDto';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import { OnlyResultDto } from '../dtos/OnlyResultDto';
import { OnlyLandmarksDto } from '../dtos/OnlyLandmarksDto';
import type { IFramesService } from '../interfaces/service/IFrameService';
import type { ModelUpload } from '../interfaces/service/IModelClient';
import { AuthenticatedUser, GoogleAuthGuard } from '../common/guards/GoogleAuthGuard';

/**
 * Thin HTTP layer: parses/validates input (via DTO decorators + the global
 * ValidationPipe), delegates to the service, returns the result.
 */
@Controller('engagement')
@UseGuards(GoogleAuthGuard)
export class FramesController {
  constructor(
    @Inject(FRAMES_SERVICE)
    private readonly framesService: IFramesService,
  ) {}

  @Post('frames')
  @HttpCode(HttpStatus.CREATED)
  async analyze(
    @Body() dto: FrameDTO,
    @Req() req: { user?: AuthenticatedUser },
    @Res({ passthrough: true }) response: Response,
  ) {
    this.applyVerifiedUser(dto, req.user);
    const result = await this.framesService.analyzeFrame(dto);
    if (result.result.status === 'pending') response.status(HttpStatus.ACCEPTED);
    return result;
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async saveSession(@Body() dto: SessionSummaryDto, @Req() req: { user?: AuthenticatedUser }) {
    this.applyVerifiedUser(dto, req.user);
    const session = await this.framesService.saveSession(dto);
    return { ok: true, session };
  }

  @Post('onlyresult')
  @HttpCode(HttpStatus.OK)
  async saveOnlyResult(@Body() dto: OnlyResultDto, @Req() req: { user?: AuthenticatedUser }) {
    this.applyVerifiedUser(dto, req.user);
    return this.framesService.saveOnlyResult(dto);
  }

  @Post('onlylandmarks')
  @HttpCode(HttpStatus.OK)
  async analyzeOnlyLandmarks(@Body() dto: OnlyLandmarksDto, @Req() req: { user?: AuthenticatedUser }) {
    this.applyVerifiedUser(dto, req.user);
    return this.framesService.analyzeOnlyLandmarks(dto);
  }

  /** Proxy video-only inference synchronously to AI /predict/video. */
  @Post('video')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'video', maxCount: 1 }], { limits: { fileSize: 200 * 1024 * 1024 } }))
  async analyzeVideo(
    @UploadedFiles() files: { video?: ModelUpload[] } | undefined,
    @Body('meta') metaJson: string | undefined,
  ) {
    const video = files?.video?.[0];
    if (!video) throw new BadRequestException('A video file is required in the "video" field.');
    return this.framesService.analyzeVideo(video, this.parseMeta(metaJson));
  }

  /** Proxy video plus aligned NumPy landmarks synchronously to AI /predict/video-landmarks. */
  @Post('video-landmarks')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'video', maxCount: 1 }, { name: 'landmarks', maxCount: 1 }],
      { limits: { fileSize: 200 * 1024 * 1024, files: 2 } },
    ),
  )
  async analyzeVideoLandmarks(
    @UploadedFiles() files: { video?: ModelUpload[]; landmarks?: ModelUpload[] } | undefined,
    @Body('meta') metaJson: string | undefined,
  ) {
    const video = files?.video?.[0];
    const landmarks = files?.landmarks?.[0];
    if (!video) throw new BadRequestException('A video file is required in the "video" field.');
    if (!landmarks || !Buffer.isBuffer(landmarks.buffer)) {
      throw new BadRequestException('A NumPy landmarks file is required in the "landmarks" field.');
    }
    return this.framesService.analyzeVideoLandmarks(video, landmarks, this.parseMeta(metaJson));
  }

  @Get('sessions/:sessionId')
  async getSession(@Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string) {
    return this.framesService.getSessionReport(sessionId);
  }

  @Post('sessions/:sessionId/flush')
  @HttpCode(HttpStatus.OK)
  async flushSession(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
  ): Promise<EngagementResultDto[]> {
    return this.framesService.flushSession(sessionId);
  }

  private applyVerifiedUser(
    dto: { userEmail: string | null; userId: string | null },
    user?: AuthenticatedUser,
  ) {
    if (!user) return;
    if (user.email) dto.userEmail = user.email;
    if (user.sub) dto.userId = user.sub;
  }

  private parseMeta(raw?: string): Record<string, unknown> {
    if (!raw?.trim()) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('meta must be a valid JSON object.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('meta must be a valid JSON object.');
    }
    return parsed as Record<string, unknown>;
  }
}
