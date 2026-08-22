import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './DatabaseModule';
import { FramesModule } from './FramesModule';

/**
 * Root module — pure composition. Connection details live in
 * DatabaseModule/RedisModule; this just assembles the app.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FramesModule,
  ],
})
export class AppModule {}
