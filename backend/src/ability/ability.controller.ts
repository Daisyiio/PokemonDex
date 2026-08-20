import { Controller, Get, Param, Query } from '@nestjs/common';
import { AbilityService } from './ability.service';

@Controller('abilities')
export class AbilityController {
  constructor(private readonly abilityService: AbilityService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.abilityService.list(search, page, pageSize);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.abilityService.detail(id);
  }
}
