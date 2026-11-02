import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { ModerationStatus } from '@badgi-studio/shared';

export class LoginDto {
  @IsString()
  password!: string;
}

export class CreateEventDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  // null clears the date.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  retentionDays?: number;

  @IsOptional()
  @IsBoolean()
  preModeration?: boolean;
}

export class ToggleStyleDto {
  @IsBoolean()
  active!: boolean;
}

export class UpdatePortraitDto {
  @IsOptional()
  @IsBoolean()
  onWall?: boolean;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsIn(['APPROVED', 'REJECTED'])
  moderation?: 'APPROVED' | 'REJECTED';
}

export class ListPortraitsQuery {
  @IsOptional()
  @IsIn(['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'])
  moderation?: ModerationStatus;
}

export class CreateKioskDto {
  @IsString()
  @Length(2, 60)
  name!: string;
}

export class ListParticipantsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
