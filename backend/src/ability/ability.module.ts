import { Module } from '@nestjs/common';
import { AbilityController } from './ability.controller';
import { AbilityService } from './ability.service';

@Module({
  controllers: [AbilityController],
  providers: [AbilityService],
})
export class AbilityModule {}
