import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}
  @Get() @ApiOperation({ summary: 'Global search and record the user search session' })
  search(@Query('q') query: string, @Query('sessionId') sessionId?: string, @Query('limit') limit?: string) { return this.service.search(query, sessionId, limit ? Number(limit) : 6); }
  @Get('history') @ApiOperation({ summary: 'Recent search history for one browser session' })
  history(@Query('sessionId') sessionId: string) { return this.service.history(sessionId); }
  @Get('trending') @ApiOperation({ summary: 'Popular searches in the last 30 days' })
  trending() { return this.service.trending(); }
}
