import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  IModelClient,
  ModelPredictionResult,
} from '../interfaces/service/IModelClient';
import { ModelInferenceException } from '../common/exceptions/Exceptions';

/**
 * Concrete transport for the deep learning model. Reads endpoint/timeout
 * from ConfigService rather than hardcoding, so environments (dev/staging/
 * prod) can point at different model deployments without code changes.
 */
@Injectable()
export class HttpModelClient implements IModelClient {
  private readonly logger = new Logger(HttpModelClient.name);
  private readonly modelUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.modelUrl = this.configService.get<string>('MODEL_ENDPOINT_URL', '');
    this.timeoutMs = this.configService.get<number>('MODEL_TIMEOUT_MS', 5000);
  }

  async predict(video: string, frameCount: number): Promise<ModelPredictionResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<ModelPredictionResult>(
          this.modelUrl,
          { video, frameCount },
          { timeout: this.timeoutMs },
        ),
      );
      return {
        engagementScore: response.data.engagementScore,
        engagementLabel: response.data.engagementLabel,
      };
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.error(`Model inference call failed: ${axiosErr.message}`);
      throw new ModelInferenceException({ cause: axiosErr.message });
    }
  }
}