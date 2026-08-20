import { Controller, Get, Param } from '@nestjs/common';
import { PokedexService } from './pokedex.service';

@Controller('pokedex')
export class PokedexController {
  constructor(private readonly pokedexService: PokedexService) {}

  @Get()
  list() {
    return this.pokedexService.list();
  }

  @Get(':name')
  get(@Param('name') name: string) {
    return this.pokedexService.get(name);
  }
}
