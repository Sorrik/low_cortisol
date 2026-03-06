import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSleepDto {
  @ApiPropertyOptional({ example: '23:30' })
  @IsOptional()
  @IsString()
  bedTime?: string;

  @ApiPropertyOptional({ example: '07:30' })
  @IsOptional()
  @IsString()
  wakeTime?: string;

  @ApiPropertyOptional({ example: 9, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  quality?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  interruptions?: number | null;  // ← добавили null

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;  // ← добавили null

  @ApiPropertyOptional()
  @IsOptional()
  durationHours?: number | null;  // ← добавили поле
}
