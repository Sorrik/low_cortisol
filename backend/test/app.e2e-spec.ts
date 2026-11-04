import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtRefreshStrategy } from '../src/auth/strategies/jwt-refresh.strategy';
import { User } from '../src/users/user.entity';

const JWT_SECRET = 'e2e-access-secret-0123456789abcdef0123';
const JWT_REFRESH_SECRET = 'e2e-refresh-secret-0123456789abcdef012';
const CREDENTIALS = {
  email: 'e2e@test.local',
  password: 'Passw0rd123',
  firstName: 'Test',
  lastName: 'User',
};
const LOGIN = { email: CREDENTIALS.email, password: CREDENTIALS.password };

// HTTP-слой, guards и валидация настоящие. БД заменена репозиторием в памяти.
function inMemoryUsers() {
  const users: User[] = [];
  return {
    findOne: async ({ where }: { where: Partial<User> }) =>
      users.find((user) =>
        Object.entries(where).every(([key, value]) => user[key as keyof User] === value),
      ) ?? null,
    create: (data: Partial<User>) => data as User,
    save: async (user: User) => {
      user.id = 'a34b2a1e-14e1-4913-9cbd-68882a59731c';
      users.push(user);
      return user;
    },
    update: async ({ id }: { id: string }, patch: Partial<User>) => {
      Object.assign(users.find((user) => user.id === id)!, patch);
    },
  };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET, JWT_REFRESH_SECRET })],
          isGlobal: true,
        }),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '15m' } }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtRefreshStrategy,
        { provide: getRepositoryToken(User), useValue: inMemoryUsers() },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const refresh = (token: string) =>
    http().post('/auth/refresh').set('Authorization', `Bearer ${token}`);

  it('rejects an invalid email and an unknown field', async () => {
    await http().post('/auth/register').send({ ...CREDENTIALS, email: 'nope' }).expect(400);
    await http().post('/auth/register').send({ ...CREDENTIALS, isAdmin: true }).expect(400);
  });

  it('covers the whole session lifecycle', async () => {
    const registered = await http().post('/auth/register').send(CREDENTIALS).expect(201);
    expect(registered.body.user.passwordHash).toBeUndefined();

    await http().post('/auth/register').send(CREDENTIALS).expect(409);
    await http().post('/auth/login').send({ ...LOGIN, password: 'Wrong12345' }).expect(401);

    const login = await http().post('/auth/login').send(LOGIN).expect(200);
    const rotated = await refresh(login.body.refresh_token).expect(200);

    // Повторное использование старого токена отзывает всю сессию.
    await refresh(login.body.refresh_token).expect(401);
    await refresh(rotated.body.refresh_token).expect(401);
  });

  it('requires an access token for logout', async () => {
    await http().post('/auth/logout').expect(401);
  });
});
