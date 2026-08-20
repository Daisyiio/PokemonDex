import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoveService } from './move.service';

@Controller('moves')
export class MoveController {
  constructor(private readonly moveService: MoveService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.moveService.list(search, type, category, page, pageSize);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.moveService.detail(id);
  }
}
