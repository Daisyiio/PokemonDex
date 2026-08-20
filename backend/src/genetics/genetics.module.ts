import { Module } from '@nestjs/common';
import { GeneticsController } from './genetics.controller';
import { GeneticsService } from './genetics.service';

@Module({
  controllers: [GeneticsController],
  providers: [GeneticsService],
})
export class GeneticsModule {}