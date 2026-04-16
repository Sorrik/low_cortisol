import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';  // ← добавить
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  // ── Swagger ────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Low Cortisol Spike API')
    .setDescription('Health tracker — sleep, mood, stress, activity, water, nutrition + ML insights')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  // ──────────────────────────────────────────

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
