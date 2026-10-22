import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('tag') tag?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.search.search(user.id, { q, type, tag, from, to });
  }

  @Get('recent')
  recent(@CurrentUser() user: AuthUser) {
    return this.search.recent(user.id);
  }
}
