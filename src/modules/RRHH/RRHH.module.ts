import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AreaController } from './controller/Area.controller';
import { CargoController } from './controller/cargo.controller';
import { EmpleadoController } from './controller/empleado.controller';


@Module({
  imports: [PrismaModule],
  controllers: [AreaController, CargoController, EmpleadoController],
  providers: [
  ],
  exports: [],
})
export class RRHHModule {}
