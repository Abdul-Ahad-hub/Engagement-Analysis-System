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
import { FrameDTO } from 'src/dtos/FrameDTO';
import { EngagementResultDto } from '../dtos/EngagementResultDto';
import type { IFramesService } from '../interfaces/service/IFrameService';

/**
 * Thin HTTP layer: parses/validates input (via DTO decorators + the global
 * ValidationPipe), delegates to the service, returns the result. No business
 * logic lives here.
 */
@Controller('frames')
export class FramesController {
  constructor(
    @Inject(FRAMES_SERVICE)
    private readonly framesService: IFramesService,
  ) {}

  @Post('analyze')
  @HttpCode(HttpStatus.CREATED)
  async analyze(@Body() dto: FrameDTO): Promise<EngagementResultDto> {
    return this.framesService.analyzeFrame(dto);
  }

  @Get(':id')
  async getResult(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EngagementResultDto> {
    return this.framesService.getResult(id);
  }
}