import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { FRAMES_SERVICE } from '../common/constants/injection-tokens';
import { FrameDTO } from '../dtos/FrameDTO';
import { SessionSummaryDto } from '../dtos/SessionSummaryDto';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import type { IFramesService } from '../interfaces/service/IFrameService';

/**
 * Domain-agnostic HTTP controller for the Engagement Analysis Engine.
 * Accepts capture windows and session summaries for any capture source,
 * delegates to the service layer, and returns the engagement analysis results.
 */
@Controller('engagement')
export class FramesController {
  constructor(
    @Inject(FRAMES_SERVICE)
    private readonly framesService: IFramesService,
  ) {}

  @Post('frames')
  @HttpCode(HttpStatus.CREATED)
  async analyze(@Body() dto: FrameDTO) {
    return this.framesService.analyzeFrame(dto);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async saveSession(@Body() dto: SessionSummaryDto) {
    const session = await this.framesService.saveSession(dto);
    return { ok: true, session };
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
}
