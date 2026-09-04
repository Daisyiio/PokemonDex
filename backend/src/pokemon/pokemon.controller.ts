import { Controller, Get, Param, Query } from '@nestjs/common';
import { PokemonService } from './pokemon.service';
import { PokemonListQueryDto } from '../dto';

@Controller('pokemon')
export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  @Get()
  list(@Query() query: PokemonListQueryDto) {
    return this.pokemonService.list(query);
  }

  @Get('types')
  types() {
    return this.pokemonService.types();
  }

  @Get('ids')
  ids() {
    return this.pokemonService.ids();
  }

  @Get('sprites')
  spritesIndex() {
    return this.pokemonService.spritesIndex();
  }

  @Get('egg-groups')
  eggGroups() {
    return this.pokemonService.eggGroups();
  }

  @Get(':id/encounters')
  encounters(@Param('id') id: string) {
    return this.pokemonService.encounters(id);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.pokemonService.detail(id);
  }
}
