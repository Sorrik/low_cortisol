// backend/src/nutrition/dto/create-nutrition.dto.ts
import { IsDateString, IsEnum, IsInt, IsNumber, IsString, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNutritionDto {
  @ApiProperty({ example: '2026-02-23' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '12:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  time!: string;

  @ApiProperty({ enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  @IsEnum(['breakfast', 'lunch', 'dinner', 'snack'])
  mealType!: string;

  @ApiProperty({ example: 'Куриный салат' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 350 })
  @IsInt()
  @Min(0)
  calories!: number;

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  @Min(0)
  proteinGrams!: number;

  @ApiProperty({ example: 60.0 })
  @IsNumber()
  @Min(0)
  carbsGrams!: number;

  @ApiProperty({ example: 16.0 })
  @IsNumber()
  @Min(0)
  fatGrams!: number;
}