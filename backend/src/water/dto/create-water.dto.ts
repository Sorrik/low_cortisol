import { IsDateString, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsRecentDate } from '../../common/validators/is-recent-date';

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateWaterDto {
  @ApiProperty({ example: '2026-02-19', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  @IsRecentDate()
  date!: string;

  @ApiProperty({ example: '08:00', description: 'Время приёма воды HH:MM или HH:MM:SS' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'time must be HH:MM or HH:MM:SS' })
  time!: string;

  @ApiProperty({ example: 500, description: 'Количество воды в мл (50–5000)', minimum: 50, maximum: 5000 })
  @IsInt()
  @Min(50)
  @Max(5000)
  amountMl!: number;
}
