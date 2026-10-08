import { Test, TestingModule } from '@nestjs/testing';
import { WebBuilderService } from './web-builder.service';

describe('WebBuilderService', () => {
  let service: WebBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebBuilderService],
    }).compile();

    service = module.get<WebBuilderService>(WebBuilderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
