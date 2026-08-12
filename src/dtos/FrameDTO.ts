import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Payload sent by the frontend for a short MP4 clip of cropped face frames.
 * The frontend has already done MediaPipe face cropping — this DTO
 * represents one clip, ready for the model.
 */
export class FrameDTO {
  @IsUUID()
  userId!: string;

  @IsUUID()
  sessionId!: string;

  @IsNotEmpty()
  @IsString()
  data!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsInt()
  @IsPositive()
  sequence!: number;
}