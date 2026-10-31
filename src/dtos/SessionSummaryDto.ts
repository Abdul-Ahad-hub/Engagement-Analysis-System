import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Sent once by the extension when the user clicks Save (or the call ends):
 * POST /engagement/sessions. Triggers the flush of buffered window results
 * into Postgres and stores the session summary.
 */
export class SessionSummaryDto {
  @IsUUID()
  sessionId!: string;

  @IsOptional()
  @IsString()
  userName!: string | null;

  @IsOptional()
  @IsEmail()
  userEmail!: string | null;

  @IsOptional()
  @IsString()
  userId!: string | null;

  @IsOptional()
  @IsString()
  meetingId!: string | null;

  @IsOptional()
  @IsString()
  role!: string | null;

  @IsDateString()
  savedAt!: string;

  @IsOptional()
  @IsDateString()
  startedAt!: string | null;

  /** "user" (Save clicked) | "call-ended" | "tab-closed". */
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
