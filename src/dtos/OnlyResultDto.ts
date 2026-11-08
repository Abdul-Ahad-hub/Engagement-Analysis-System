import { IsArray, IsBoolean, IsDateString, IsEmail, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class OnlyResultDto {
  @IsString() resultId!: string;
  @IsUUID() sessionId!: string;
  @IsOptional() @IsString() meetingId!: string | null;
  @IsInt() @Min(0) windowIndex!: number;
  @IsDateString() startedAt!: string;
  @IsDateString() at!: string;
  @IsString() source!: string;
  @IsOptional() @IsString() cause!: string | null;
  @IsBoolean() partial!: boolean;
  @IsInt() @Min(0) faceFrames!: number;
  @IsInt() @Min(0) framesInWindow!: number;
  @IsString() label!: string;
  @IsInt() classIndex!: number;
  @IsNumber() confidence!: number;
  @IsObject() probs!: Record<string, number>;
  @IsArray() @IsString({ each: true }) classNames!: string[];
  @IsOptional() @IsObject() timingMs!: Record<string, number> | null;
  @IsOptional() @IsEmail() userEmail!: string | null;
  @IsOptional() @IsString() userName!: string | null;
  @IsOptional() @IsString() userId!: string | null;
}
