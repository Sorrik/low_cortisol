import { IsDateString, IsInt, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWaterDto {
  @ApiProperty({ example: '2026-02-19', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: '08:00', description: 'Время приёма воды HH:MM' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'time must be HH:MM format' })
  time!: string;

  @ApiProperty({ example: 500, description: 'Количество воды в мл (минимум 50)', minimum: 50 })
  @IsInt()
  @Min(50)
  amountMl!: number;
}
