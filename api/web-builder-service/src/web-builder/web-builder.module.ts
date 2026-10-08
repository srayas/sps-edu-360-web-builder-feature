import { Module } from '@nestjs/common';
import { WebBuilderController } from './web-builder.controller';
import { WebBuilderService } from './web-builder.service';

@Module({
  controllers: [WebBuilderController],
  providers: [WebBuilderService],
  exports: [WebBuilderService],
})
export class WebBuilderModule {}
