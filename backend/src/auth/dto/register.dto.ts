import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email пользователя' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Example2024', description: 'Минимум 8 символов, буквы и цифры' })
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @MaxLength(128, { message: 'Пароль слишком длинный' })
  @Matches(/(?=.*[a-zA-Zа-яА-Я])(?=.*\d)/, {
    message: 'Пароль должен содержать буквы и цифры',
  })
  password!: string;

  @ApiProperty({ example: 'Иван' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Иванов' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: '1995-06-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
