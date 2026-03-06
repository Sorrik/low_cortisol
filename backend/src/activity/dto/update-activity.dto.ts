import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateActivityDto {
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

  @ApiPropertyOptional({ example: 'Обновлённая заметка' })
  @IsOptional()
  @IsString()
  notes?: string;
}
