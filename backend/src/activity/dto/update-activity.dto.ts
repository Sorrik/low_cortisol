import { IsEnum, IsInt, IsOptional, IsString, Min, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateActivityDto {
  @ApiPropertyOptional({ example: '20:30', description: 'Время тренировки HH:MM' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string;

  @ApiPropertyOptional({ example: 'run', enum: ['walk', 'run', 'yoga', 'gym', 'sport', 'other'] })
  @IsOptional()
  @IsEnum(['walk', 'run', 'yoga', 'gym', 'sport', 'other'])
  type?: string;

  @ApiPropertyOptional({ example: 60, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'vigorous', enum: ['light', 'moderate', 'vigorous'] })
  @IsOptional()
  @IsEnum(['light', 'moderate', 'vigorous'])
  intensity?: string;

  @ApiPropertyOptional({ example: 400, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  caloriesBurned?: number;

  @ApiPropertyOptional({ example: 8000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  steps?: number;

  @ApiPropertyOptional({ example: 'Обновлённая заметка' })
  @IsOptional()
  @IsString()
  notes?: string;
}