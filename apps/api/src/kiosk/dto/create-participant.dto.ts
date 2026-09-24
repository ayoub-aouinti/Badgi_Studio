import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, Length, Matches, ValidateIf } from 'class-validator';

export class CreateParticipantDto {
  @ApiProperty({ minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  firstName!: string;

  @ApiProperty({ minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  lastName!: string;

  // Manual entry rule (docs/SPEC.md): email or WhatsApp is required, unless the participant
  // comes from a badge scan (attendeeId set) where contact info was already prefilled by Badgi.
  @ApiPropertyOptional()
  @ValidateIf((o) => !o.attendeeId && !o.whatsappE164)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'E.164, e.g. +21620000000' })
  @ValidateIf((o) => !o.attendeeId && !o.email)
  @IsString()
  @Matches(/^\+[1-9][0-9]{7,14}$/, { message: 'whatsappE164 must be a valid E.164 number' })
  whatsappE164?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ description: 'Set when confirming a badge scan (source = BADGE)' })
  @IsOptional()
  @IsUUID()
  attendeeId?: string;
}
