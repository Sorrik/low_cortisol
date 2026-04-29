import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: Partial<User>;
}

@Injectable()
export class AuthService {
  private readonly accessTtl: string;
  private readonly refreshSecret: string;
  private readonly refreshTtl: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    this.refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');

    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret || refreshSecret.length < 32) {
      throw new Error(
        'JWT_REFRESH_SECRET env var is required and must be at least 32 chars',
      );
    }
    this.refreshSecret = refreshSecret;
  }

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const exists = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });

    const saved: User = await this.usersRepo.save(user);
    return this.issueTokens(saved);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  // Refresh rotation: проверяем что присланный refresh совпадает с хешем в БД,
  // и сразу выдаём новую пару с новым refresh — старый становится невалидным.
  // Защищает от reuse: если старый refresh попадёт злоумышленнику, второй вызов
  // вернёт 401, а легитимный пользователь обнаружит проблему при следующей попытке.
  async refresh(userId: string, presentedRefresh: string): Promise<AuthTokens> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const matches = await bcrypt.compare(presentedRefresh, user.refreshTokenHash);
    if (!matches) {
      // Не совпадает — возможно, токен украден и уже использован. Сбрасываем сессию.
      await this.usersRepo.update({ id: userId }, { refreshTokenHash: null });
      throw new UnauthorizedException('Refresh token mismatch — session invalidated');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepo.update({ id: userId }, { refreshTokenHash: null });
  }

  // Подписывает новую пару (access + refresh) и сохраняет хеш refresh-а в users.
  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.accessTtl as unknown as number,
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl as unknown as number,
    });

    const refreshHash = await bcrypt.hash(refresh_token, 10);
    await this.usersRepo.update({ id: user.id }, { refreshTokenHash: refreshHash });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
