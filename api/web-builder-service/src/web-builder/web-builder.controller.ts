import { Controller, Get } from '@nestjs/common';
import { WebBuilderService } from './web-builder.service';
import { CustomLogger } from '@spsedu360/common-be-config';

@Controller('web-builder')
export class WebBuilderController {
  private readonly logger = new CustomLogger({
    currentExecutor: WebBuilderController.name,
  });

  constructor(private readonly builderService: WebBuilderService) {}
  @Get()
  getBuilderData() {
    this.logger.log('Inside getBuilderData');
    return this.builderService.getBuilderData();
  }

  @Get('/test')
  getBuilderData2() {
    this.logger.log('Inside getBuilderData');
    return this.builderService.getBuilderData();
  }
}
