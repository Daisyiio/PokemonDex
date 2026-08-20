import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { GeneticsService } from './genetics.service';

@Controller('genetics')
export class GeneticsController {
  constructor(private readonly geneticsService: GeneticsService) {}

  @Get('species')
  species() {
    return this.geneticsService.species();
  }

  @Get('species/:id/egg-moves')
  eggMoves(@Param('id') id: string) {
    return this.geneticsService.eggMoves(id);
  }

  @Post('plan')
  plan(@Body() body: { targetId: string; moves?: string[]; generation?: number }) {
    return this.geneticsService.plan(body.targetId, body.moves || [], body.generation || 6);
  }
}