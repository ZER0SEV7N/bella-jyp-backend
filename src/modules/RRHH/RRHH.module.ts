import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import * as AreaUseCase from './use-cases/area';
import * as CargoUseCase from './use-cases/cargos';
import * as EmpleadoCase from './use-cases/empleado';
import { AuditCreateUseCase } from './use-cases/audit/create.UseCase';
import { ClsModule } from 'nestjs-cls';

import {
  AreaController,
  CargoController,
  EmpleadoController,
} from './controller';
@Module({
  imports: [PrismaModule, ClsModule],
  controllers: [AreaController, CargoController, EmpleadoController],
  providers: [
    ...Object.values(AreaUseCase),
    ...Object.values(CargoUseCase),
    ...Object.values(EmpleadoCase),
    AuditCreateUseCase,
  ],
  exports: [],
})
export class RRHHModule {}
