import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';

/** CRUD and publishing for projects created in the web builder studio. */
@ApiTags('web-builder projects')
@Controller('web-builder/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List project summaries, newest first' })
  list() {
    return this.projects.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get the working copy of a project' })
  get(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Create or replace a project' })
  save(@Param('id') id: string, @Body() body: unknown) {
    return this.projects.save(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project and its published app' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a snapshot of the project' })
  publish(@Param('id') id: string, @Body() body: unknown) {
    return this.projects.publish(id, body);
  }

  @Get(':id/published')
  @ApiOperation({ summary: 'Get the published snapshot served to visitors' })
  published(@Param('id') id: string) {
    return this.projects.getPublished(id);
  }
}
