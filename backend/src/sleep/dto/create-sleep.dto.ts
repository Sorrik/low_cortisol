import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSleepDto {
  @ApiProperty({ example: '2026-02-19' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '23:00' })
  @IsString()
  bedTime!: string;  // ← убрали @Matches — БД хранит HH:MM:SS

  @ApiProperty({ example: '07:00' })
  @IsString()
  wakeTime!: string;  // ← убрали @Matches

  @ApiProperty({ example: 8, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quality!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  interruptions?: number | null;  // ← добавили null

  @ApiPropertyOptional({ example: 'Спал хорошо' })
  @IsOptional()
  @IsString()
  notes?: string | null;  // ← добавили null

  @ApiPropertyOptional({ example: 7.5 })
  @IsOptional()
  durationHours?: number | null;  // ← добавили поле
}
