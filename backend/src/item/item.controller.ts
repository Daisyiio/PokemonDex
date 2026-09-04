import { Controller, Get, Param, Query } from '@nestjs/common';
import { ItemService } from './item.service';
import { ItemListQueryDto } from '../dto';

@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Get('categories')
  categories() {
    return this.itemService.categories();
  }

  @Get()
  list(@Query() query: ItemListQueryDto) {
    return this.itemService.list(
      query.search,
      query.category,
      query.page,
      query.pageSize,
    );
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.itemService.detail(id);
  }
}
