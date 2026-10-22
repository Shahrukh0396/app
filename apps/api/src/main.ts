import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { readEnv } from './config/env';
import { JsonLogger } from './logger/json.logger';

async function bootstrap(): Promise<void> {
  const env = readEnv();
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(env.nodeEnv === 'production'),
  });
  app.use(helmet());
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  const http = app.getHttpAdapter().getInstance() as { set?: (key: string, value: number) => void };
  http.set?.('trust proxy', 1);
  app.enableShutdownHooks();
  await app.listen(env.port, '0.0.0.0');
}

void bootstrap();
