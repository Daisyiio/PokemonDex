import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { BreedingService } from './breeding.service';
import { BreedingPlanDto, BreedingSimulateDto } from '../dto';

@Controller('breeding')
export class BreedingController {
  constructor(private readonly breedingService: BreedingService) {}

  @Get('species')
  species() {
    return this.breedingService.species();
  }

  @Get('species/:id/moves')
  speciesMoves(@Param('id') id: string) {
    return this.breedingService.speciesMoves(id);
  }

  @Post('plan')
  plan(@Body() body: BreedingPlanDto) {
    return this.breedingService.plan(body.targetId, body.moves || []);
  }

  @Post('simulate')
  simulate(@Body() body: BreedingSimulateDto) {
    return this.breedingService.simulate(body);
  }
}