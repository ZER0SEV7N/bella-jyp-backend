//src/modules/RRHH/RRHH.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClsModule } from 'nestjs-cls';
// --- CONTROLADORES ---
import { AreaController } from './controller/Area.controller';
import { CargoController } from './controller/cargo.controller';
import { EmpleadoController } from './controller/empleado.controller';
import { EmpleadoBulkController } from './controller/empleado-bulk.controller';
import { JornadaController } from './controller/jornada.controller';
// --- CASOS DE USO: ÁREA ---
import { CrearAreaUseCase } from './use-cases/area/crearArea.useCase';
import { ActualizarAreaUseCase } from './use-cases/area/actualizarArea.useCase';
import { EliminarAreaUseCase } from './use-cases/area/eliminarArea.useCase';
import { ActiveAreaUseCase } from './use-cases/area/activeArea.useCase';
<<<<<<< HEAD
import { ListarAreasUseCase } from './use-cases/area/listarAreas.useCase';
=======
import { ObtenerAreaUseCase } from './use-cases/area/obtenerArea.useCase';
>>>>>>> feature/RrhhModule
// --- CASOS DE USO: CARGO ---
import { CrearCargoUseCase } from './use-cases/cargos/crearCargo.UseCase';
import { ActualizarCargoUseCase } from './use-cases/cargos/actualizarCargo.UseCase';
import { EliminarCargoUseCase } from './use-cases/cargos/eliminarCargo.UseCase';
import { ActiveCargoUseCase } from './use-cases/cargos/activeCargo.useCase';
<<<<<<< HEAD
import { ListarCargosUseCase } from './use-cases/cargos/listarCargos.useCase';
// --- CASOS DE USO: EMPLEADO ---
import { CrearEmpleadoUseCase } from './use-cases/empleado/crearEmpleado.useCase';
import { ListarEmpleadosUseCase } from './use-cases/empleado/listarEmpleados.useCase';
=======
import { ObtenerCargoUseCase } from './use-cases/cargos/obtenerCargo.useCase';
// --- CASOS DE USO: EMPLEADO ---
import { CrearEmpleadoUseCase } from './use-cases/empleado/crearEmpleado.UseCase';
import { ObtenerEmpleadosUseCase } from './use-cases/empleado/obtenerEmpleados.useCase';
>>>>>>> feature/RrhhModule
import { EditarEmpleadoUseCase } from './use-cases/empleado/editarEmpleado.useCase';
import { EliminarEmpleadoUseCase } from './use-cases/empleado/eliminarEmpleado.useCase';
import { ActiveEmpleadoUseCase } from './use-cases/empleado/activeEmpleado.useCase';
// --- CASOS DE USO: CARGA MASIVA ---
import { ProcesarCargaMasivaUseCase } from './use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { ConsultarEstadoCargaMasivaUseCase } from './use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ProcesarFilaEmpleadoUseCase } from './use-cases/carga-masiva/procesarFilaEmpleado.useCase';
// --- CASOS DE USO: JORNADAS ---
import { CrearJornadaUseCase } from './use-cases/jornadas/crearJornada.useCase';
import { EditarJornadaUseCase } from './use-cases/jornadas/editarJornada.useCase';
import { EstadoJornadaUseCase } from './use-cases/jornadas/estadoJornada.useCase';
import { ListarJornadaUseCase } from './use-cases/jornadas/listarJornada.useCase';

// --- SERVICIOS Y WORKERS ---
import { ReniecAdapter } from './services/reniec.adapter';
import { CargaMasivaProcessor } from '../../workers/carga-masiva/carga-masiva.processor';

@Module({
  imports: [
    // Importamos la cola para poder inyectarla en el Carga Masiva UseCase
    BullModule.registerQueue({ name: 'rrhh-bulk-queue' }),
    ClsModule,
  ],
  controllers: [
    AreaController,
    CargoController,
    EmpleadoController,
    EmpleadoBulkController,
    JornadaController,
  ],
  providers: [
    //Areas
    CrearAreaUseCase,
    ActualizarAreaUseCase,
    EliminarAreaUseCase,
    ActiveAreaUseCase,
    ListarAreasUseCase,
    //Cargos
    CrearCargoUseCase,
    ActualizarCargoUseCase,
    EliminarCargoUseCase,
    ActiveCargoUseCase,
    ListarCargosUseCase,
    //Empleados
    CrearEmpleadoUseCase,
    ListarEmpleadosUseCase,
    EditarEmpleadoUseCase,
    EliminarEmpleadoUseCase,
    ActiveEmpleadoUseCase,
    //Carga Masiva
    ProcesarCargaMasivaUseCase,
    ConsultarEstadoCargaMasivaUseCase,
    ProcesarFilaEmpleadoUseCase,
    CargaMasivaProcessor,
    //Jornadas
    CrearJornadaUseCase,
    EditarJornadaUseCase,
    EstadoJornadaUseCase,
    ListarJornadaUseCase,
    //Adaptadores Externos
    ReniecAdapter,
  ],
})
export class RRHHModule {}
