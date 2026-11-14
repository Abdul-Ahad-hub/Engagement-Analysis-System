import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class OnlyLandmarksDto {
  @IsUUID() sessionId!: string;
  @IsInt() @Min(0) windowIndex!: number;
  @IsDateString() startedAt!: string;
  @IsDateString() endedAt!: string;
  @IsBoolean() partial!: boolean;
  @IsInt() @Min(0) framesFilled!: number;
  @IsNumber() frameIntervalMs!: number;
  @IsArray() @IsBoolean({ each: true }) faceDetected!: boolean[];
  @IsArray() landmarks!: number[][][];
  @IsArray() @IsInt({ each: true }) landmarkIndices!: number[];
  @IsInt() landmarkCount!: number;
  @IsOptional() @IsString() reason!: string | null;
}
