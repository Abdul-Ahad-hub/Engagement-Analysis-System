import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Domain-agnostic payload of ONE capture window (POST /engagement/frames).
 * Contains only capture session identity, frame pixels, facial landmarks,
 * and capture timing — completely independent of any specific meeting
 * platform or user account system.
 */

export class CropBoxDto {
  @IsIn(['face', 'center'])
  source!: 'face' | 'center';

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  @Min(0)
  size!: number;

  @IsInt()
  @Min(1)
  frameWidth!: number;

  @IsInt()
  @Min(1)
  frameHeight!: number;
}

export class FrameTimingDto {
  @IsNumber()
  meshMs!: number;

  @IsNumber()
  cropMs!: number;

  @IsNumber()
  totalMs!: number;
}

export class WindowTimingDto {
  @IsNumber()
  avgFrameMs!: number;

  @IsNumber()
  maxFrameMs!: number;

  @IsNumber()
  avgMeshMs!: number;

  @IsNumber()
  encodeMs!: number;

  @IsNumber()
  windowSpanMs!: number;
}

export class FrameItemDto {
  @IsInt()
  @Min(0)
  index!: number;

  @IsOptional()
  @IsDateString()
  capturedAt!: string | null;

  @IsBoolean()
  faceDetected!: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CropBoxDto)
  cropBox!: CropBoxDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => FrameTimingDto)
  timingMs!: FrameTimingDto | null;

  @IsIn(['base64'])
  encoding!: 'base64';

  @IsIn(['uint8'])
  dtype!: 'uint8';

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  shape!: [number, number, number];

  @IsIn(['RGB'])
  channelOrder!: 'RGB';

  @IsString()
  @IsNotEmpty()
  data!: string;
}

export class FrameDTO {
  /** Unique identifier of the capture session (UUID v4). */
  @IsUUID()
  sessionId!: string;

  @IsInt()
  @Min(0)
  windowIndex!: number;

  @IsDateString()
  startedAt!: string;

  @IsDateString()
  endedAt!: string;

  @IsBoolean()
  partial!: boolean;

  @IsInt()
  @Min(0)
  @Max(256)
  framesFilled!: number;

  @IsNumber()
  frameIntervalMs!: number;

  @IsArray()
  @IsBoolean({ each: true })
  faceDetected!: boolean[];

  @ValidateNested()
  @Type(() => WindowTimingDto)
  timing!: WindowTimingDto;

  /** [frames][52][3], normalised to the full camera frame; zeros where no face. */
  @IsArray()
  landmarks!: number[][][];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameItemDto)
  frames!: FrameItemDto[];

  @IsArray()
  @IsInt({ each: true })
  landmarkIndices!: number[];

  @IsInt()
  landmarkCount!: number;
}
