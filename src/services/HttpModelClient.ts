import { deflateSync } from 'zlib';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IModelClient,
  ModelInput,
  ModelPredictionResult,
  ModelUpload,
} from '../interfaces/service/IModelClient';
import { ModelInferenceException } from '../common/exceptions/Exceptions';

/**
 * Concrete transport for the deep learning model hosted at MODEL_ENDPOINT_URL
 * (POST https://.../predict/frames).
 *
 * Converts the 16 base64 raw RGB (160x160x3 uint8) frames into 16 PNG files
 * and the [16][52][3] landmarks array into a NumPy v1.0 float32 .npy file,
 * then posts multipart/form-data { frames, landmarks, meta } to the model.
 */
@Injectable()
export class HttpModelClient implements IModelClient {
  private readonly logger = new Logger(HttpModelClient.name);
  private readonly modelUrl: string;
  private readonly timeoutMs: number;
  private readonly landmarksUrl: string;
  private readonly videoUrl: string;
  private readonly videoLandmarksUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.modelUrl = (
      this.configService.get<string>('MODEL_URL') ||
      this.configService.get<string>('MODEL_ENDPOINT_URL') ||
      ''
    ).trim();
    this.timeoutMs = Number(this.configService.get('MODEL_TIMEOUT_MS') ?? 30000);
    this.landmarksUrl = (this.configService.get<string>('MODEL_LANDMARKS_URL') ?? '').trim();
    this.videoUrl = (this.configService.get<string>('MODEL_VIDEO_URL') ?? '').trim();
    this.videoLandmarksUrl = (this.configService.get<string>('MODEL_VIDEO_LANDMARKS_URL') ?? '').trim();
    if (!this.modelUrl) {
      this.logger.warn('MODEL_URL is not configured; cloud frame inference will return an error until it is set.');
    } else {
      this.logger.log(`Model endpoint configured: ${this.modelUrl} (timeout ${this.timeoutMs}ms)`);
    }
  }

  async predict(input: ModelInput): Promise<ModelPredictionResult> {
    if (!this.modelUrl) {
      throw new ModelInferenceException({ cause: 'MODEL_URL is not set in environment variables' });
    }

    const [height, width] = input.frameShape;
    const formData = new FormData();

    // 1) 16 cropped RGB frames -> lossless PNG files (frame_00.png .. frame_15.png)
    for (let i = 0; i < input.frames.length; i++) {
      const rgb = Buffer.from(input.frames[i], 'base64');
      const png = this.encodeRgbPng(width, height, rgb);
      formData.append(
        'frames',
        new Blob([new Uint8Array(png)], { type: 'image/png' }),
        `frame_${String(i).padStart(2, '0')}.png`,
      );
    }

    // 2) [16][52][3] landmarks -> NumPy .npy binary (float32, shape (16, 52, 3))
    const npy = this.encodeNpyFloat32(input.landmarks);
    formData.append(
      'landmarks',
      new Blob([new Uint8Array(npy)], { type: 'application/octet-stream' }),
      'landmarks.npy',
    );

    // 3) Window metadata JSON
    formData.append('meta', JSON.stringify(input.meta));

    try {
      const started = Date.now();
      const res = await fetch(this.modelUrl, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        body: formData,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const rawText = await res.text();
      if (!res.ok) {
        throw new ModelInferenceException({
          cause: `HTTP ${res.status}: ${rawText.slice(0, 300)}`,
        });
      }

      const data = JSON.parse(rawText) as unknown;
      const parsed = this.parse(data);
      this.logger.log(
        `Model predicted in ${Date.now() - started}ms -> label=${parsed.engagementLabel}, ` +
          `score=${parsed.engagementScore} (session=${input.meta.sessionId}, window=${input.meta.windowIndex})`,
      );
      return parsed;
    } catch (err) {
      if (err instanceof ModelInferenceException) throw err;
      const msg = (err as Error).message;
      this.logger.error(`Model inference call failed: ${msg}`);
      throw new ModelInferenceException({ cause: msg });
    }
  }

  async predictLandmarks(input: Omit<ModelInput, 'frames' | 'frameShape'>): Promise<ModelPredictionResult> {
    if (!this.landmarksUrl) throw new ModelInferenceException({ cause: 'MODEL_LANDMARKS_URL is not configured' });
    try {
      const res = await fetch(this.landmarksUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        // The AI TCN endpoint accepts only the landmarks property. Keep caller metadata
        // in NestJS for persistence; do not send unsupported fields to the model.
        body: JSON.stringify({ landmarks: input.landmarks }), signal: AbortSignal.timeout(this.timeoutMs),
      });
      const raw = await res.text();
      if (!res.ok) throw new ModelInferenceException({ cause: `HTTP ${res.status}: ${raw.slice(0, 300)}` });
      const data = JSON.parse(raw) as unknown;
      return this.parse(data);
    } catch (err) {
      if (err instanceof ModelInferenceException) throw err;
      throw new ModelInferenceException({ cause: (err as Error).message });
    }
  }

  async predictVideo(video: ModelUpload, meta: Record<string, unknown>): Promise<ModelPredictionResult> {
    if (!this.videoUrl) throw new ModelInferenceException({ cause: 'MODEL_VIDEO_URL is not configured' });
    const form = new FormData();
    form.append('video', new Blob([new Uint8Array(video.buffer)], { type: video.mimetype || 'application/octet-stream' }), video.originalname);
    form.append('meta', JSON.stringify(meta));
    return this.postForm(this.videoUrl, form);
  }

  async predictVideoLandmarks(
    video: ModelUpload,
    landmarks: ModelUpload,
    meta: Record<string, unknown>,
  ): Promise<ModelPredictionResult> {
    if (!this.videoLandmarksUrl) throw new ModelInferenceException({ cause: 'MODEL_VIDEO_LANDMARKS_URL is not configured' });
    const form = new FormData();
    form.append('video', new Blob([new Uint8Array(video.buffer)], { type: video.mimetype || 'application/octet-stream' }), video.originalname);
    form.append('landmarks', new Blob([new Uint8Array(landmarks.buffer)], { type: landmarks.mimetype || 'application/octet-stream' }), landmarks.originalname || 'landmarks.npy');
    form.append('meta', JSON.stringify(meta));
    return this.postForm(this.videoLandmarksUrl, form);
  }

  private async postForm(url: string, form: FormData): Promise<ModelPredictionResult> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const raw = await res.text();
      if (!res.ok) throw new ModelInferenceException({ cause: `HTTP ${res.status}: ${raw.slice(0, 300)}` });
      return this.parse(JSON.parse(raw) as unknown);
    } catch (err) {
      if (err instanceof ModelInferenceException) throw err;
      throw new ModelInferenceException({ cause: (err as Error).message });
    }
  }

  private parse(data: unknown): ModelPredictionResult {
    // Model returns e.g. [{"windowIndex": 0, "engagement_Level": 0, "confidence": 0.6376}]
    const unwrapped = Array.isArray(data) ? data[0] : data;
    const root = (unwrapped ?? {}) as Record<string, unknown>;
    const candidates = [root, root.result, root.data].filter(
      (c): c is Record<string, unknown> => !!c && typeof c === 'object',
    );
    const pick = (keys: string[]) => {
      for (const c of candidates)
        for (const k of keys) if (c[k] !== undefined && c[k] !== null) return c[k];
      return undefined;
    };

    const score = Number(
      pick([
        'confidence',
        'engagementScore',
        'engagement_score',
        'score',
        'engagement',
        'probability',
      ]),
    );
    const label = pick([
      'engagement_Level',
      'engagement_level',
      'engagementLabel',
      'engagement_label',
      'label',
      'prediction',
      'class',
    ]);

    if (!Number.isFinite(score) && label === undefined) {
      throw new ModelInferenceException({
        cause: 'Model response has no score/label field',
        response: JSON.stringify(data)?.slice(0, 300),
      });
    }

    return {
      engagementScore: Number.isFinite(score) ? score : null,
      engagementLabel: label !== undefined ? String(label) : 'unknown',
      raw: data,
    };
  }

  /** Encodes raw uint8 RGB bytes (width * height * 3) into a valid PNG buffer. */
  private encodeRgbPng(width: number, height: number, rgb: Buffer): Buffer {
    const stride = width * 3;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
      raw[y * (stride + 1)] = 0; // filter type 0 (None)
      rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type 2 = truecolor RGB
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.concat([
      signature,
      this.pngChunk('IHDR', ihdr),
      this.pngChunk('IDAT', deflateSync(raw)),
      this.pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }

  private pngChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(this.crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  private crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  /** Encodes a 3D number array [N][52][3] as a standard NumPy v1.0 float32 .npy buffer. */
  private encodeNpyFloat32(landmarks3d: number[][][]): Buffer {
    const d0 = landmarks3d.length;
    const d1 = landmarks3d[0]?.length ?? 52;
    const d2 = landmarks3d[0]?.[0]?.length ?? 3;
    const headerStr = `{'descr': '<f4', 'fortran_order': False, 'shape': (${d0}, ${d1}, ${d2}), }`;
    const preambleLen = 10;
    const padLen = 64 - ((preambleLen + headerStr.length + 1) % 64);
    const paddedHeader = headerStr + ' '.repeat(padLen === 64 ? 0 : padLen) + '\n';
    const headerBuf = Buffer.from(paddedHeader, 'ascii');

    const preamble = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 0x01, 0x00, 0x00, 0x00]);
    preamble.writeUInt16LE(headerBuf.length, 8);

    const floats = new Float32Array(d0 * d1 * d2);
    let idx = 0;
    for (let i = 0; i < d0; i++) {
      for (let j = 0; j < d1; j++) {
        for (let k = 0; k < d2; k++) {
          floats[idx++] = landmarks3d[i][j][k];
        }
      }
    }
    return Buffer.concat([preamble, headerBuf, Buffer.from(floats.buffer)]);
  }
}
