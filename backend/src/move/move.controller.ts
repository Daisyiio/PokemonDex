import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoveService } from './move.service';
import { MoveListQueryDto } from '../dto';

@Controller('moves')
export class MoveController {
  constructor(private readonly moveService: MoveService) {}

  @Get()
  list(@Query() query: MoveListQueryDto) {
    return this.moveService.list(
      query.search,
      query.type,
      query.category,
      query.page,
      query.pageSize,
    );
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.moveService.detail(id);
  }
}
