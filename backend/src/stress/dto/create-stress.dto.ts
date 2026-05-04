import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsRecentDate } from '../../common/validators/is-recent-date';

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateStressDto {
  @ApiProperty({ example: '2026-02-19', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  @IsRecentDate()
  date!: string;

  @ApiProperty({ example: '14:00', description: 'Время записи HH:MM или HH:MM:SS' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'time must be HH:MM or HH:MM:SS' })
  time!: string;

  @ApiProperty({ example: 6, description: 'Уровень стресса от 1 до 10', minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  level!: number;

  @ApiPropertyOptional({ example: 'work deadline', description: 'Причина стресса' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cause?: string;

  @ApiPropertyOptional({ example: 'breathing exercise', description: 'Способ справиться' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  copingStrategy?: string;
}
