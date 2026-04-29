import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    // Default JwtModule подписывает access-токен. Refresh подписывается
    // напрямую через jwtService.sign() с явным secret/expiresIn в AuthService.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET env var is required and must be at least 32 chars');
        }
        const accessTtl = config.get<string>('JWT_ACCESS_TTL', '15m');
        return {
          secret,
          signOptions: { expiresIn: accessTtl as unknown as number },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  controllers: [AuthController],
  exports: [JwtStrategy, JwtRefreshStrategy, JwtModule],
})
export class AuthModule {}
