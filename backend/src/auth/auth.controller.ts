import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService, AuthTokens } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtRefreshGuard } from './jwt-refresh.guard';

const REFRESH_COOKIE = 'refresh_token';

interface RefreshUser {
  userId: string;
  email: string;
  refreshToken: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @ApiResponse({ status: 201, description: 'Пользователь создан' })
  @ApiResponse({ status: 409, description: 'Email уже занят' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    return this.respondWithTokens(tokens, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход — выдаёт access + refresh токены' })
  @ApiResponse({ status: 200, description: 'Возвращает access_token (refresh — в HttpOnly cookie или body)' })
  @ApiResponse({ status: 401, description: 'Неверный email или пароль' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    return this.respondWithTokens(tokens, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Обновить access (и ротировать refresh)' })
  @ApiResponse({ status: 200, description: 'Новая пара токенов' })
  @ApiResponse({ status: 401, description: 'Refresh невалиден или отозван' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const u = req.user as RefreshUser;
    const tokens = await this.authService.refresh(u.userId, u.refreshToken);
    return this.respondWithTokens(tokens, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout — отзывает refresh-токен на сервере' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const u = req.user as { userId: string };
    await this.authService.logout(u.userId);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }

  // Кладёт refresh в HttpOnly cookie (браузер) И возвращает в body (mobile).
  // Клиент сам решает, что использовать — RN читает body, frontend полагается на cookie.
  private respondWithTokens(tokens: AuthTokens, res: Response) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, tokens.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
    });
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: tokens.user,
    };
  }
}
