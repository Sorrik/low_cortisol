import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsRecentDate } from '../../common/validators/is-recent-date';

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateActivityDto {
  @ApiProperty({ example: '2026-02-19', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  @IsRecentDate()
  date!: string;

  @ApiPropertyOptional({ example: '20:30', description: 'Время тренировки HH:MM или HH:MM:SS' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'time must be HH:MM or HH:MM:SS' })
  time?: string;

  @ApiProperty({ example: 'walk', enum: ['walk', 'run', 'yoga', 'gym', 'sport', 'other'] })
  @IsEnum(['walk', 'run', 'yoga', 'gym', 'sport', 'other'])
  type!: string;

  @ApiProperty({ example: 40, minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @ApiProperty({ example: 'moderate', enum: ['light', 'moderate', 'vigorous'] })
  @IsEnum(['light', 'moderate', 'vigorous'])
  intensity!: string;

  @ApiPropertyOptional({ example: 250, minimum: 0, maximum: 10_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  caloriesBurned?: number;

  @ApiPropertyOptional({ example: 8000, minimum: 0, maximum: 100_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  steps?: number;

  @ApiPropertyOptional({ example: 'Прогулка в парке' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
