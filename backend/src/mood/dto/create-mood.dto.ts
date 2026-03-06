import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMoodDto {
  @ApiProperty({ example: '2026-02-19' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  time!: string;

  @ApiProperty({ example: 7, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  moodScore!: number;

  @ApiPropertyOptional({ example: 'calm, focused' })
  @IsOptional()
  @IsString()
  emotions?: string | null;    // ← добавить null

  @ApiPropertyOptional({ example: 'work, weather' })
  @IsOptional()
  @IsString()
  triggers?: string | null;    // ← добавить null

  @ApiPropertyOptional({ example: 'Хороший день' })
  @IsOptional()
  @IsString()
  notes?: string | null;       // ← добавить null
}
