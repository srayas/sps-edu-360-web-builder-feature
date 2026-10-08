import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebBuilderModule } from './web-builder/web-builder.module';
import { ProjectsModule } from './projects/projects.module';
import { RuntimeModule } from './runtime/runtime.module';
import { ApiMiddleware, CustomLogger } from '@spsedu360/common-be-config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WebBuilderModule,
    ProjectsModule,
    RuntimeModule,
  ],
  controllers: [],
  providers: [CustomLogger],
  exports: [CustomLogger],
})
export class AppModule {
  constructor() {
    CustomLogger.setAppName('Builder-Service');
  }
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiMiddleware).forRoutes('*');
  }
}
