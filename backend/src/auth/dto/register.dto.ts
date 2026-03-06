import { IsEmail, IsString, MinLength, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';  // ← добавить

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email пользователя' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Минимум 6 символов' })
  @IsString()
  @MinLength(6)
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
