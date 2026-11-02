import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export class UpdateBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  eventName?: string;

  @ApiPropertyOptional({ description: 'Short line under the title; empty string clears it' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  tagline?: string;

  @ApiPropertyOptional({ example: '#0B6E69' })
  @IsOptional()
  @Matches(HEX)
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#5FD3C8' })
  @IsOptional()
  @Matches(HEX)
  accentColor?: string;

  @ApiPropertyOptional({ enum: ['none', 'banner', 'border', 'polaroid'] })
  @IsOptional()
  @IsIn(['none', 'banner', 'border', 'polaroid'])
  frameStyle?: string;

  @ApiPropertyOptional({ example: '#0E1B2C' })
  @IsOptional()
  @Matches(HEX)
  frameColor?: string;

  @ApiPropertyOptional({ minimum: 8, maximum: 96 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(96)
  frameWidth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showName?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;
}
