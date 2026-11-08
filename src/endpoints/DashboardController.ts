import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { FRAMES_SERVICE } from '../common/constants/injection-tokens';
import { AuthenticatedUser, GoogleAuthGuard } from '../common/guards/GoogleAuthGuard';
import type { IFramesService } from '../interfaces/service/IFrameService';

/**
 * Read-only endpoints for the analytics dashboard. Unlike the extension's
 * write endpoints, a verified Google bearer token is mandatory here, and
 * every response is scoped to the signed-in user's own sessions.
 */
@Controller('engagement/me')
@UseGuards(GoogleAuthGuard)
export class DashboardController {
  constructor(
    @Inject(FRAMES_SERVICE)
    private readonly framesService: IFramesService,
  ) {}

  @Get('sessions')
  async listSessions(@Req() req: { user?: AuthenticatedUser }) {
    const email = this.requireEmail(req.user);
    return { sessions: await this.framesService.listUserSessions(email) };
  }

  @Get('sessions/:sessionId')
  async getSession(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Req() req: { user?: AuthenticatedUser },
  ) {
    const email = this.requireEmail(req.user);
    const report = await this.framesService.getUserSessionReport(sessionId, email);
    if (!report) throw new NotFoundException('Session not found');
    return report;
  }

  private requireEmail(user?: AuthenticatedUser): string {
    if (!user?.email) {
      throw new UnauthorizedException('A Google bearer token with the email scope is required');
    }
    return user.email;
  }
}
