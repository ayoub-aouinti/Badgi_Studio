import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreatePortraitDto {
  @ApiProperty()
  @IsUUID()
  styleId!: string;
}
