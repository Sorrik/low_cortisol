import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

// Извлекает refresh-токен сначала из HTTP-only cookie (frontend),
// затем из body.refresh_token (mobile), затем из Authorization header.
function refreshExtractor(req: Request): string | null {
  const cookieToken = (req?.cookies as Record<string, string> | undefined)?.['refresh_token'];
  if (cookieToken) return cookieToken;

  const bodyToken = (req?.body as { refresh_token?: string } | undefined)?.refresh_token;
  if (bodyToken) return bodyToken;

  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET env var is required and must be at least 32 chars');
    }
    super({
      jwtFromRequest: refreshExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; email: string }) {
    const presented = refreshExtractor(req);
    if (!presented) throw new UnauthorizedException('Refresh token missing');
    return { userId: payload.sub, email: payload.email, refreshToken: presented };
  }
}
