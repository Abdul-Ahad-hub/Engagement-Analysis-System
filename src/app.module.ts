import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './modules/DatabaseModule';
import { FramesModule } from './modules/FramesModule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FramesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
