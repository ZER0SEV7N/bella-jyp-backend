import { Module } from '@nestjs/common';
import { CargoService } from './cargo.service';
import { CargoController } from './cargo.controller';

@Module({
  controllers: [CargoController],
  providers: [CargoService],
})
export class CargoModule {}
