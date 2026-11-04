import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMoodDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  time?: string | null;        // ← добавить null

  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  moodScore?: number;

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
