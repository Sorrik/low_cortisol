import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsRecentDate } from '../../common/validators/is-recent-date';

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateMoodDto {
  @ApiProperty({ example: '2026-02-19' })
  @IsDateString()
  @IsRecentDate()
  date!: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'time must be HH:MM or HH:MM:SS' })
  time!: string;

  @ApiProperty({ example: 7, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  moodScore!: number;

  @ApiPropertyOptional({ example: 'calm, focused' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  emotions?: string | null;

  @ApiPropertyOptional({ example: 'work, weather' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  triggers?: string | null;

  @ApiPropertyOptional({ example: 'Хороший день' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
