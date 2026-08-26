import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/DatabaseModule';
import { FramesModule } from './modules/FramesModule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FramesModule,
  ],
})
export class AppModule {}
