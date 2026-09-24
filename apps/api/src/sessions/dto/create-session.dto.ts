import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsUUID, ValidateNested } from 'class-validator';

export class ConsentsDto {
  @ApiProperty({ description: 'Mandatory (docs/SPEC.md): must be true to open a session' })
  @IsBoolean()
  aiProcessing!: boolean;

  @ApiProperty()
  @IsBoolean()
  wall!: boolean;

  @ApiProperty()
  @IsBoolean()
  sponsor!: boolean;
}

export class CreateSessionDto {
  @ApiProperty()
  @IsUUID()
  participantId!: string;

  @ApiProperty({ type: ConsentsDto })
  @ValidateNested()
  @Type(() => ConsentsDto)
  consents!: ConsentsDto;
}
