import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class BadgeScanDto {
  @ApiProperty({ description: 'Opaque token read from the badge QR code' })
  @IsString()
  @MinLength(4)
  token!: string;
}
