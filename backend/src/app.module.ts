import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PokemonModule } from './pokemon/pokemon.module';
import { PokedexModule } from './pokedex/pokedex.module';
import { MoveModule } from './move/move.module';
import { AbilityModule } from './ability/ability.module';
import { ItemModule } from './item/item.module';

@Module({
  imports: [
    PrismaModule,
    PokemonModule,
    PokedexModule,
    MoveModule,
    AbilityModule,
    ItemModule,
  ],
})
export class AppModule {}
