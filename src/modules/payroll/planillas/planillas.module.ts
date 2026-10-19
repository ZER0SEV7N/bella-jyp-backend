import { PayrollPoolService } from '@/workers/calculo-masivo/payroll-pool.service';
import { COLA_PAYROLL, PayrollProcessor } from '@/workers/calculo-masivo/payroll.processor';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DesembolsosPlanillaController } from './controller/desembolsos-planilla.controller';
import { NovedadesPlanillaController } from './controller/novedades-planilla.controller';
import { PlanillasController } from './controller/planillas.controller';
import { ColaPayrollService } from './services/cola-payroll.service';
import { ProcesamientoMasivoPlanillasService } from './services/procesamiento-masivo-planilla.service';
import { CongelarPlanillaUseCase } from './use-case/planillas/congelarPlanilla.useCase';
import { ConsultarTrabajoPlanillasUseCase } from './use-case/planillas/consultarJobPlanillas.useCase';
import { CrearNovedadPlanillaUseCase } from './use-case/novedades/crearNovedadPlanilla.useCase';
import { DescargarBoletaUseCase } from './use-case/descargarBoleta.useCase';
import { GenerarPlanillaUseCase } from './use-case/planillas/generarPlanilla.useCase';
import { ListarNovedadesPlanillaUseCase } from './use-case/novedades/listarNovedadesPlanilla.useCase';
import { ListarPlanillasUseCase } from './use-case/planillas/listarPlanilla.useCase';
import { ObtenerPlanillaUseCase } from './use-case/planillas/obtenerPlanilla.useCase';
import { RegistrarDesembolsoUseCase } from './use-case/desembolso/registrarDesembolso.useCase';
import { ResolverNovedadPlanillaUseCase } from './use-case/novedades/resolverNovedadPlanilla.useCase';
import { SolicitarGeneracionPlanillasUseCase } from './use-case/solicitarGeneracionPlanilla.useCase';

@Module({
    imports: [BullModule.registerQueue({ name: COLA_PAYROLL })],
    controllers: [PlanillasController, NovedadesPlanillaController, DesembolsosPlanillaController],
    providers: [
        ProcesamientoMasivoPlanillasService,
        DescargarBoletaUseCase,
        ObtenerPlanillaUseCase,
        RegistrarDesembolsoUseCase,
        GenerarPlanillaUseCase,
        ResolverNovedadPlanillaUseCase,
        SolicitarGeneracionPlanillasUseCase,
        CongelarPlanillaUseCase,
        CrearNovedadPlanillaUseCase,
        ListarPlanillasUseCase,
        ListarNovedadesPlanillaUseCase,
        ConsultarTrabajoPlanillasUseCase,
        ColaPayrollService,
        PayrollPoolService,
        PayrollProcessor
    ]
})
export class PlanillasModule {}
