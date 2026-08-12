/**
 * Shape returned to the frontend after a frame has been analyzed
 * and persisted. Kept separate from the entity so the API contract
 * doesn't leak internal storage columns.
 */
export class EngagementResultDto {
  id!: string;
  userId!: string;
  sessionId!: string;
  engagementScore!: number;
  engagementLabel!: string;
  startTime!: string;
  endTime!: string;
  
}