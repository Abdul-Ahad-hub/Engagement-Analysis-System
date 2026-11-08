import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getHello(): string {
    return 'Hello World!';
  }

  getHealth() {
    return {
      ok: true,
      status: 'ok',
      service: 'engagement-backend',
      mode: 'sync',
      databaseConfigured: Boolean(this.config.get<string>('DATABASE_URL')),
      configuredModelRoutes: {
        frames: Boolean(this.config.get<string>('MODEL_URL') || this.config.get<string>('MODEL_ENDPOINT_URL')),
        video: Boolean(this.config.get<string>('MODEL_VIDEO_URL')),
        videoLandmarks: Boolean(this.config.get<string>('MODEL_VIDEO_LANDMARKS_URL')),
        landmarks: Boolean(this.config.get<string>('MODEL_LANDMARKS_URL')),
      },
    };
  }
}
