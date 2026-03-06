import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStressDto {
  @ApiPropertyOptional({ example: '15:00', description: 'HH:MM' })
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  time?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number;

  @ApiPropertyOptional({ example: 'personal issues' })
  @IsOptional()
  @IsString()
  cause?: string;

  @ApiPropertyOptional({ example: 'meditation' })
  @IsOptional()
  @IsString()
  copingStrategy?: string;
}
