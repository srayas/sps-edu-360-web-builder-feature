import { Injectable } from '@nestjs/common';
import { CustomLogger } from '@spsedu360/common-be-config';

@Injectable()
export class WebBuilderService {
  private readonly logger = new CustomLogger({
    currentExecutor: WebBuilderService.name,
  });
  getBuilderData() {
    this.logger.log('Inside getBuilderData service');
    return [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Doe' },
    ];
  }
}
