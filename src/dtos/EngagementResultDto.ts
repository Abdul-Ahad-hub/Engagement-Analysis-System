/**
 * Domain-agnostic shape returned after a capture window has been analyzed
 * and buffered.
 */
export class EngagementResultDto {
  id!: string;
  sessionId!: string;
  windowIndex!: number;
  /** null when the model was not called (see `status`). */
  engagementScore!: number | null;
  engagementLabel!: string;
  /** Pending async inference, completed inference, skipped window, or inference failure. */
  status!: 'inferred' | 'skipped' | 'pending' | 'failed';
  /** Why inference was skipped (e.g. "too_few_faces"), else null. */
  skipReason!: string | null;
  framesFilled!: number;
  faceFrames!: number;
  partial!: boolean;
  startTime!: string;
  endTime!: string;
}
