import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FramesController } from '../endpoints/FramesController';
import { AiCallbacksController } from '../endpoints/AiCallbacksController';
import { FramesService } from '../services/FramesService';
import { FramesRepository } from '../repositories/FramesRepository';
import { HttpModelClient } from '../services/HttpModelClient';
import { EngagementRecord } from '../entities/EngagementRecord';
import { EngagementSession } from '../entities/EngagementSession';
import { GoogleAuthGuard } from '../common/guards/GoogleAuthGuard';
import { RedisModule } from './RedisModule';
import {
  FRAMES_REPOSITORY,
  FRAMES_SERVICE,
  MODEL_CLIENT,
} from '../common/constants/injection-tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([EngagementRecord, EngagementSession]),
    HttpModule,
    RedisModule,
  ],
  controllers: [FramesController, AiCallbacksController],
  providers: [
    GoogleAuthGuard,
    { provide: FRAMES_SERVICE, useClass: FramesService },
    { provide: FRAMES_REPOSITORY, useClass: FramesRepository },
    { provide: MODEL_CLIENT, useClass: HttpModelClient },
  ],
  exports: [FRAMES_SERVICE],
})
export class FramesModule {}
