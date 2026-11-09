import { Body, Controller, Inject, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { FRAMES_SERVICE } from '../common/constants/injection-tokens';
import type { IFramesService } from '../interfaces/service/IFrameService';

@Controller('engagement/ai-callbacks')
export class AiCallbacksController {
  private readonly logger = new Logger(AiCallbacksController.name);

  constructor(
    @Inject(FRAMES_SERVICE) private readonly framesService: IFramesService,
    private readonly config: ConfigService,
  ) {}

  private authorize(req: { headers?: Record<string, string | undefined> }) {
    const expected = this.config.get<string>('AI_CALLBACK_TOKEN') ?? '';
    const authorization = req.headers?.authorization ?? '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const expectedBuf = Buffer.from(expected);
    const suppliedBuf = Buffer.from(supplied);
    if (!expected || expectedBuf.length !== suppliedBuf.length || !timingSafeEqual(expectedBuf, suppliedBuf)) {
      throw new UnauthorizedException('Invalid AI callback token');
    }
  }

  @Post('received')
  received(@Req() req: { headers?: Record<string, string | undefined> }, @Body() body: unknown) {
    this.authorize(req);
    if (!Array.isArray(body)) return { ok: false, error: 'Expected a list of callback items' };
    this.logger.log(`AI accepted callback: ${body.length} job(s)`);
    return { ok: true };
  }

  @Post('results')
  async results(@Req() req: { headers?: Record<string, string | undefined> }, @Body() body: unknown) {
    this.authorize(req);
    if (!Array.isArray(body) || body.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return { ok: false, error: 'Expected a list of result objects' };
    }
    for (const item of body as Record<string, unknown>[]) {
      await this.framesService.handleAiResult(item);
    }
    this.logger.log(`AI result callback persisted: ${body.length} item(s)`);
    return { ok: true, received: body.length };
  }
}
