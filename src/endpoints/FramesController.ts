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
  Req,
  UseGuards,
} from '@nestjs/common';

import { FRAMES_SERVICE } from '../common/constants/injection-tokens';
import { FrameDTO } from '../dtos/FrameDTO';
import { SessionSummaryDto } from '../dtos/SessionSummaryDto';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import type { IFramesService } from '../interfaces/service/IFrameService';
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
  async analyze(@Body() dto: FrameDTO, @Req() req: { user?: AuthenticatedUser }) {
    this.applyVerifiedUser(dto, req.user);
    return this.framesService.analyzeFrame(dto);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async saveSession(@Body() dto: SessionSummaryDto, @Req() req: { user?: AuthenticatedUser }) {
    this.applyVerifiedUser(dto, req.user);
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

  private applyVerifiedUser(
    dto: { userEmail: string | null; userId: string | null },
    user?: AuthenticatedUser,
  ) {
    if (!user) return;
    if (user.email) dto.userEmail = user.email;
    if (user.sub) dto.userId = user.sub;
  }
}
