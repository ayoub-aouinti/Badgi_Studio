import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class PairKioskDto {
  @ApiProperty({ example: '123456', description: '6-digit pairing code shown in the dashboard' })
  @IsString()
  @Length(6, 6)
  pairingCode!: string;
}
