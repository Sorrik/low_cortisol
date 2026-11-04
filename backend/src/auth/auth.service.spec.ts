import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';

const USER_ID = 'a34b2a1e-14e1-4913-9cbd-68882a59731c';

function createService() {
  const user = {
    id: USER_ID,
    email: 'user@test.local',
    refreshTokenHash: null,
  } as unknown as User;

  const repo = {
    findOne: jest.fn(async () => user),
    update: jest.fn(async (_: unknown, patch: Partial<User>) => {
      Object.assign(user, patch);
    }),
  };
  const jwt = new JwtService({ secret: 'a'.repeat(32) });
  const config = new ConfigService({ JWT_REFRESH_SECRET: 'b'.repeat(32) });

  return { service: new AuthService(repo as never, jwt, config), user };
}

describe('AuthService refresh rotation', () => {
  it('keeps the stored hash within the column length', async () => {
    const { service, user } = createService();
    await service['issueTokens'](user);
    expect(user.refreshTokenHash).toHaveLength(64);
  });

  it('issues a different refresh token on every call', async () => {
    const { service, user } = createService();
    const first = await service['issueTokens'](user);
    const second = await service['issueTokens'](user);
    expect(first.refresh_token).not.toEqual(second.refresh_token);
  });

  it('accepts the current refresh token and rotates it', async () => {
    const { service, user } = createService();
    const { refresh_token } = await service['issueTokens'](user);
    const next = await service.refresh(USER_ID, refresh_token);
    expect(next.refresh_token).not.toEqual(refresh_token);
  });

  it('rejects a rotated token and revokes the session', async () => {
    const { service, user } = createService();
    const stolen = (await service['issueTokens'](user)).refresh_token;
    const current = (await service.refresh(USER_ID, stolen)).refresh_token;

    await expect(service.refresh(USER_ID, stolen)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(user.refreshTokenHash).toBeNull();
    await expect(service.refresh(USER_ID, current)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
