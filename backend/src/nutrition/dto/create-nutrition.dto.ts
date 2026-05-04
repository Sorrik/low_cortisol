// backend/src/nutrition/dto/create-nutrition.dto.ts
import { IsDateString, IsEnum, IsInt, IsNumber, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsRecentDate } from '../../common/validators/is-recent-date';

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateNutritionDto {
  @ApiProperty({ example: '2026-02-23' })
  @IsDateString()
  @IsRecentDate()
  date!: string;

  @ApiProperty({ example: '12:00' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'time must be HH:MM or HH:MM:SS' })
  time!: string;

  @ApiProperty({ enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  @IsEnum(['breakfast', 'lunch', 'dinner', 'snack'])
  mealType!: string;

  @ApiProperty({ example: 'Куриный салат' })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 350, minimum: 0, maximum: 5000 })
  @IsInt()
  @Min(0)
  @Max(5000)
  calories!: number;

  @ApiProperty({ example: 25.5, minimum: 0, maximum: 1000 })
  @IsNumber()
  @Min(0)
  @Max(1000)
  proteinGrams!: number;

  @ApiProperty({ example: 60.0, minimum: 0, maximum: 1000 })
  @IsNumber()
  @Min(0)
  @Max(1000)
  carbsGrams!: number;

  @ApiProperty({ example: 16.0, minimum: 0, maximum: 1000 })
  @IsNumber()
  @Min(0)
  @Max(1000)
  fatGrams!: number;
}
