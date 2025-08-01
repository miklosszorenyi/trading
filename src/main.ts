import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // Raw body middleware csak a webhook endpoint-okhoz
    // app.use('/webhook', express.raw({
    //   type: '*/*',
    //   limit: '10mb' // Maximális body méret beállítása
    // }));

    // Enable validation pipes globally
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    // Enable CORS for webhook endpoints
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.log(`🚀 Binance Trading Backend running on port ${port}`);
    logger.log(`📊 Ready to receive TradingView webhooks`);
  } catch (error) {
    logger.error('❌ Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();