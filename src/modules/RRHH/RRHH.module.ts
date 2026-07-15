import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AreaController } from './controller/Area.controller';
import { CargoController } from './controller/cargo.controller';
import { EmpleadoController } from './controller/empleado.controller';
import { AreaUseCase, CargoUseCase, EmpleadoCase } from './use-cases';


@Module({
  imports: [PrismaModule],
  controllers: [AreaController, CargoController, EmpleadoController],
  providers: [
    ...Object.values(AreaUseCase),
    ...Object.values(CargoUseCase),
    ...Object.values(EmpleadoCase),
  ],
  exports: [],
})
export class RRHHModule {}
