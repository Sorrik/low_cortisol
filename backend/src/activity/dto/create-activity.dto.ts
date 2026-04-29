import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActivityDto {
  @ApiProperty({ example: '2026-02-19', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: '20:30', description: 'Время тренировки HH:MM' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string;

  @ApiProperty({ example: 'walk', enum: ['walk', 'run', 'yoga', 'gym', 'sport', 'other'] })
  @IsEnum(['walk', 'run', 'yoga', 'gym', 'sport', 'other'])
  type!: string;

  @ApiProperty({ example: 40, minimum: 1 })
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiProperty({ example: 'moderate', enum: ['light', 'moderate', 'vigorous'] })
  @IsEnum(['light', 'moderate', 'vigorous'])
  intensity!: string;

  @ApiPropertyOptional({ example: 250, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  caloriesBurned?: number;

  @ApiPropertyOptional({ example: 8000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  steps?: number;

  @ApiPropertyOptional({ example: 'Прогулка в парке' })
  @IsOptional()
  @IsString()
  notes?: string;
}