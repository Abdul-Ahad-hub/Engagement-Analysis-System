import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Domain-agnostic session summary payload (POST /engagement/sessions).
 * Triggers the flush of buffered window results into Postgres and computes
 * aggregate engagement metrics for the capture session.
 */
export class SessionSummaryDto {
  @IsUUID()
  sessionId!: string;

  @IsDateString()
  savedAt!: string;

  @IsOptional()
  @IsDateString()
  startedAt!: string | null;

  @IsOptional()
  @IsString()
  endReason!: string | null;

  @IsInt()
  @Min(0)
  framesCaptured!: number;

  @IsInt()
  @Min(0)
  framesWithFace!: number;

  @IsInt()
  @Min(0)
  framesCenterCrop!: number;

  @IsNumber()
  avgFrameMs!: number;

  @IsNumber()
  maxFrameMs!: number;

  @IsInt()
  @Min(0)
  windowsSent!: number;

  @IsInt()
  @Min(0)
  windowsUnsent!: number;
}
