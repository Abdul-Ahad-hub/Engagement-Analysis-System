/** Raw prediction payload returned by the deep learning model. */
export interface ModelPredictionResult {
  engagementScore: number;
  engagementLabel: string;
}

/**
 * Contract for talking to the deep learning model, wherever it's hosted.
 * Isolates HTTP/gRPC/queue details from the service layer so the transport
 * can change, and so this is trivially mockable in service-layer tests.
 */
export interface IModelClient {
  predict(video: string, frameCount: number): Promise<ModelPredictionResult>;
}