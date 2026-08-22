import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { GeneticsService } from './genetics.service';

@Controller('genetics')
export class GeneticsController {
  constructor(private readonly geneticsService: GeneticsService) {}

  @Get('species')
  species() {
    return this.geneticsService.species();
  }

  @Get('species/:id/egg-moves')
  eggMoves(@Param('id') id: string, @Query('gen') gen?: string) {
    return this.geneticsService.eggMoves(id, gen ? Number(gen) : undefined);
  }

  @Get('species/:id/all-moves')
  allMoves(@Param('id') id: string, @Query('gen') gen?: string) {
    return this.geneticsService.allMovesByGen(id, gen ? Number(gen) : undefined);
  }

  @Post('direct-parents')
  directParents(@Body() body: { targetId: string; moves?: string[]; generation?: number; includePrevGen?: boolean }) {
    return this.geneticsService.findDirectParents(body.targetId, body.moves || [], body.generation || 6, body.includePrevGen || false);
  }

  @Post('plan')
  plan(@Body() body: { targetId: string; moves?: string[]; generation?: number }) {
    return this.geneticsService.plan(body.targetId, body.moves || [], body.generation || 6);
  }
}