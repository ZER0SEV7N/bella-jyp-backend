//src/modules/RRHH/RRHH.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// --- CONTROLADORES ---
import { AreaController } from './controller/area.controller';
import { CargoController } from './controller/cargo.controller';
import { EmpleadoController } from './controller/empleado.controller';
import { EmpleadoBulkController } from './controller/empleado-bulk.controller';

// --- CASOS DE USO: ÁREA ---
import { CrearAreaUseCase } from './use-cases/area/crearArea.useCase';
import { ActualizarAreaUseCase } from './use-cases/area/actualizarArea.useCase';
import { EliminarAreaUseCase } from './use-cases/area/eliminarArea.useCase';
import { ActiveAreaUseCase } from './use-cases/area/activeArea.useCase';

// --- CASOS DE USO: CARGO ---
import { CrearCargoUseCase } from './use-cases/cargos/crearCargo.useCase';
import { ActualizarCargoUseCase } from './use-cases/cargos/actualizarCargo.useCase';
import { EliminarCargoUseCase } from './use-cases/cargos/eliminarCargo.useCase';
import { ActiveCargoUseCase } from './use-cases/cargos/activeCargo.useCase';

// --- CASOS DE USO: EMPLEADO ---
import { CrearEmpleadoUseCase } from './use-cases/empleado/crearEmpleado.useCase';
import { ObtenerEmpleadosUseCase } from './use-cases/empleado/obtenerEmpleados.useCase';
import { EditarEmpleadoUseCase } from './use-cases/empleado/editarEmpleado.useCase';
import { EliminarEmpleadoUseCase } from './use-cases/empleado/eliminarEmpleado.useCase';
import { ActiveEmpleadoUseCase } from './use-cases/empleado/activeEmpleado.useCase';

// --- CASOS DE USO: CARGA MASIVA ---
import { ProcesarCargaMasivaUseCase } from './use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { ConsultarEstadoCargaMasivaUseCase } from './use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ProcesarFilaEmpleadoUseCase } from './use-cases/carga-masiva/procesarFilaEmpleado.useCase';



// --- SERVICIOS Y WORKERS ---
import { ReniecAdapter } from './services/reniec.adapter';
import { CargaMasivaProcessor } from '../../workers/carga-masiva/carga-masiva.processor';

@Module({
  imports: [
    // Importamos la cola para poder inyectarla en el Carga Masiva UseCase
    BullModule.registerQueue({ name: 'rrhh-bulk-queue', }),
  ],
  controllers: [
    AreaController,
    CargoController,
    EmpleadoController,
    EmpleadoBulkController,
  ],
  providers: [
    // Áreas
    CrearAreaUseCase,
    ActualizarAreaUseCase,
    EliminarAreaUseCase,
    ActiveAreaUseCase,
    // Cargos
    CrearCargoUseCase,
    ActualizarCargoUseCase,
    EliminarCargoUseCase,
    ActiveCargoUseCase,
    // Empleados
    CrearEmpleadoUseCase,
    ObtenerEmpleadosUseCase,
    EditarEmpleadoUseCase,
    EliminarEmpleadoUseCase,
    ActiveEmpleadoUseCase,
    // Carga Masiva
    ProcesarCargaMasivaUseCase,
    ConsultarEstadoCargaMasivaUseCase,
    ProcesarFilaEmpleadoUseCase,
    CargaMasivaProcessor,
    // Adaptadores Externos
    ReniecAdapter,
  ],
})
export class RRHHModule {}