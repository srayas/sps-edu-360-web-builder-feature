import { Test, TestingModule } from '@nestjs/testing';
import { WebBuilderController } from './web-builder.controller';

describe('WebBuilderController', () => {
  let controller: WebBuilderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebBuilderController],
    }).compile();

    controller = module.get<WebBuilderController>(WebBuilderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
