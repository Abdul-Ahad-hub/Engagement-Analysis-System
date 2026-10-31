import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // One extension window is ~1.6 MB of JSON (16 base64 face crops + landmarks).
  // Express' default limit is 100 kb, which would answer 413.
  const bodyLimit = process.env.BODY_LIMIT ?? '10mb';
  app.useBodyParser('json', { limit: bodyLimit });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // The extension calls from its service worker (chrome-extension://<id>), which
  // is covered by host_permissions, but CORS stays open for tools/dashboards.
  app.enableCors();
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port} (body limit ${bodyLimit})`, 'Bootstrap');
}
bootstrap();
