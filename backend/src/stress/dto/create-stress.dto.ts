import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStressDto {
  @ApiProperty({ example: '2026-02-19', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '14:00', description: 'Время записи HH:MM' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'time must be HH:MM format' })
  time!: string;

  @ApiProperty({ example: 6, description: 'Уровень стресса от 1 до 10', minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  level!: number;

  @ApiPropertyOptional({ example: 'work deadline', description: 'Причина стресса' })
  @IsOptional()
  @IsString()
  cause?: string;

  @ApiPropertyOptional({ example: 'breathing exercise', description: 'Способ справиться' })
  @IsOptional()
  @IsString()
  copingStrategy?: string;
}
