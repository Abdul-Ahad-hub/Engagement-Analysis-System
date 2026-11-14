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
  /** Whether the model ran or the window was skipped by a business rule. */
  status!: 'inferred' | 'skipped';
  /** Why inference was skipped (e.g. "too_few_faces"), else null. */
  skipReason!: 'too_few_frames' | 'too_few_faces' | null;
  framesFilled!: number;
  faceFrames!: number;
  partial!: boolean;
  startTime!: string;
  endTime!: string;
}
