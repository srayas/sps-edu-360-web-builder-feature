import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';

@Module({
  imports: [ProjectsModule],
  controllers: [RuntimeController],
  providers: [RuntimeService],
})
export class RuntimeModule {}
