import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsRecentDate } from '../../common/validators/is-recent-date';

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateSleepDto {
  @ApiProperty({ example: '2026-02-19' })
  @IsDateString()
  @IsRecentDate()
  date!: string;

  @ApiProperty({ example: '23:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'bedTime must be HH:MM or HH:MM:SS' })
  bedTime!: string;

  @ApiProperty({ example: '07:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'wakeTime must be HH:MM or HH:MM:SS' })
  wakeTime!: string;

  @ApiProperty({ example: 8, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quality!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  interruptions?: number | null;

  @ApiPropertyOptional({ example: 'Спал хорошо' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ example: 7.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(18)
  durationHours?: number | null;
}
