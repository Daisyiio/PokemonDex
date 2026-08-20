import { Controller, Get, Param, Query } from '@nestjs/common';
import { PokemonService } from './pokemon.service';

@Controller('pokemon')
export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('gen') gen?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.pokemonService.list({ search, type, gen, page, pageSize });
  }

  @Get('types')
  types() {
    return this.pokemonService.types();
  }

  @Get('ids')
  ids() {
    return this.pokemonService.ids();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.pokemonService.detail(id);
  }
}
