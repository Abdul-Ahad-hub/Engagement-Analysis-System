import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';

let cachedServer: Express | null = null;

export async function createConfiguredApp(): Promise<{
  app: NestExpressApplication;
  expressApp: Express;
}> {
  const expressApp = express();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
  );

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
  return { app, expressApp };
}

async function bootstrap() {
  const { app } = await createConfiguredApp();
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  const bodyLimit = process.env.BODY_LIMIT ?? '10mb';
  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port} (body limit ${bodyLimit})`, 'Bootstrap');
}

// Only start an HTTP listener when running locally (not inside Vercel serverless).
if (!process.env.VERCEL) {
  bootstrap();
}

// Exported handler for Vercel's NestJS runtime when it targets src/main.ts directly.
export default async function handler(req: Request, res: Response) {
  if (!cachedServer) {
    const { app, expressApp } = await createConfiguredApp();
    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer(req, res);
}
