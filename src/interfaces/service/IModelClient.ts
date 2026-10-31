/** Raw prediction payload returned by the deep learning model. */
export interface ModelPredictionResult {
  /** null when the model only returns a label. */
  engagementScore: number | null;
  engagementLabel: string;
  /** Anything else the model returned (probabilities, per-frame scores...). */
  raw?: unknown;
}

/**
 * What the backend sends to the model for one window. Frames stay separate
 * (one base64 string per frame, each `frameShape` uint8 RGB, row-major) and
 * landmarks are their own field, exactly as captured by the extension.
 */
export interface ModelInput {
  /** N base64 strings, each decoding to frameShape[0]*frameShape[1]*frameShape[2] bytes. */
  frames: string[];
  /** [N][52][3] normalised to the full camera frame; zeros where no face. */
  landmarks: number[][][];
  /** [N] - false means the frame is a center crop and its landmarks are zeros. */
  faceDetected: boolean[];
  /** [height, width, channels], e.g. [160, 160, 3]. */
  frameShape: [number, number, number];
  landmarkIndices: number[];
  meta: {
    sessionId: string;
    meetingId: string | null;
    windowIndex: number;
    userEmail: string | null;
    partial: boolean;
    framesFilled: number;
    frameIntervalMs: number;
    startedAt: string;
    endedAt: string;
  };
}

/**
 * Contract for talking to the deep learning model, wherever it's hosted.
 * Isolates HTTP/gRPC/queue details from the service layer so the transport
 * can change, and so this is trivially mockable in service-layer tests.
 */
export interface IModelClient {
  predict(input: ModelInput): Promise<ModelPredictionResult>;
}
