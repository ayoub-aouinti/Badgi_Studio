import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateParticipantDto {
  @ApiProperty({ minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  firstName!: string;

  @ApiProperty({ minLength: 2, maxLength: 60 })
  @IsString()
  @Length(2, 60)
  lastName!: string;

  // Contact details are optional: without them the portrait is still available through the
  // download QR code on the result screen.
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'E.164, e.g. +21620000000' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9][0-9]{7,14}$/, { message: 'whatsappE164 must be a valid E.164 number' })
  whatsappE164?: string;
}
