import { Controller, Get, Query } from '@nestjs/common';
import { ItemService } from './item.service';

@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Get('categories')
  categories() {
    return this.itemService.categories();
  }

  @Get()
  list(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.itemService.list(search, category, page, pageSize);
  }
}
