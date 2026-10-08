import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CustomLogger, ResponseInterceptor } from '@spsedu360/common-be-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Builder projects can be a few megabytes (the service enforces a 4 MB limit per project).
  app.useBodyParser('json', { limit: '5mb' });
  const port = process.env.PORT || 3000;
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const config = new DocumentBuilder()
    .setTitle('spsedu360 Web builder |  Srayas P')
    .setDescription('Api Documentation for the web builder service')
    .setVersion('0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/swagger', app, document);
  const logger = app.get(CustomLogger);
  app.useLogger(logger);
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📜 Swagger Docs available at: http://localhost:${port}/swagger`);
}
bootstrap();
