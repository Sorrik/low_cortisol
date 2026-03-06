import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActivityDto {
  @ApiProperty({ example: '2026-02-19', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'walk', enum: ['walk', 'run', 'yoga', 'gym', 'sport', 'other'] })
  @IsEnum(['walk', 'run', 'yoga', 'gym', 'sport', 'other'])
  type!: string;

  @ApiProperty({ example: 40, description: 'Длительность в минутах', minimum: 1 })
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiProperty({ example: 'moderate', enum: ['light', 'moderate', 'vigorous'] })
  @IsEnum(['light', 'moderate', 'vigorous'])
  intensity!: string;

  @ApiPropertyOptional({ example: 250, description: 'Сожжённые калории', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  caloriesBurned?: number;

  @ApiPropertyOptional({ example: 'Прогулка в парке' })
  @IsOptional()
  @IsString()
  notes?: string;
}
