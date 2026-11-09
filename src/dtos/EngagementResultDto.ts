/**
 * Shape returned to the frontend after a window has been analyzed
 * and buffered. Kept separate from the entity so the API contract
 * doesn't leak internal storage columns.
 */
export class EngagementResultDto {
  id!: string;
  sessionId!: string;
  meetingId!: string | null;
  userEmail!: string | null;
  userName!: string | null;
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
