import { IsInt, IsOptional, Matches, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWaterDto {
  @ApiPropertyOptional({ example: '09:00', description: 'HH:MM' })
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  time?: string;

  @ApiPropertyOptional({ example: 300, description: 'Количество воды в мл (минимум 50)', minimum: 50 })
  @IsOptional()
  @IsInt()
  @Min(50)
  amountMl?: number;
}
