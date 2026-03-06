import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';  // ← добавить

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto }    from './dto/login.dto';

@ApiTags('Auth')                    // ← группа в Swagger UI
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @ApiResponse({ status: 201, description: 'Пользователь создан' })
  @ApiResponse({ status: 409, description: 'Email уже занят' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Вход — получить JWT токен' })
  @ApiResponse({ status: 200, description: 'Возвращает access_token' })
  @ApiResponse({ status: 401, description: 'Неверный email или пароль' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

}
