import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RuntimeQueryInput, RuntimeService } from './runtime.service';

/** Data used by running apps: collection records and the framed queries designed in the studio. */
@ApiTags('web-builder runtime')
@Controller('web-builder/runtime/:projectId/collections/:sourceId')
export class RuntimeController {
  constructor(private readonly runtime: RuntimeService) {}

  @Get()
  @ApiOperation({ summary: 'All records of a collection' })
  list(
    @Param('projectId') projectId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.runtime.list(projectId, sourceId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a record (idempotent by record id)' })
  add(
    @Param('projectId') projectId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: unknown,
  ) {
    return this.runtime.add(projectId, sourceId, body);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove every record of a collection' })
  clear(
    @Param('projectId') projectId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.runtime.clear(projectId, sourceId);
  }

  @Patch(':recordId')
  @ApiOperation({ summary: 'Update one record' })
  update(
    @Param('projectId') projectId: string,
    @Param('sourceId') sourceId: string,
    @Param('recordId') recordId: string,
    @Body() body: unknown,
  ) {
    return this.runtime.update(projectId, sourceId, recordId, body);
  }

  @Delete(':recordId')
  @ApiOperation({ summary: 'Delete one record' })
  removeRecord(
    @Param('projectId') projectId: string,
    @Param('sourceId') sourceId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.runtime.removeRecord(projectId, sourceId, recordId);
  }

  @Post('query')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Run the saved query frame with parameter values, a search term and paging',
  })
  query(
    @Param('projectId') projectId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: RuntimeQueryInput,
  ) {
    return this.runtime.query(projectId, sourceId, body ?? {});
  }
}
