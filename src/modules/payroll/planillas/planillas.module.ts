import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PlanillasController } from './controller/planillas.controller';
import { PlanillasService } from './services/planillas.service';
import { ColaPayrollService } from './services/cola-payroll.service';
import { PayrollPoolService } from '@/workers/payroll/payroll-pool.service';
import { COLA_PAYROLL, PayrollProcessor } from '@/workers/payroll/payroll.processor';
import { NovedadesPlanillaService } from './services/novedades-planilla.service';
import { BoletasService } from './services/boletas.service';

@Module({ 
    imports: [BullModule.registerQueue({ name: COLA_PAYROLL })], 
    controllers: [PlanillasController], 
    providers: [PlanillasService, BoletasService, NovedadesPlanillaService, ColaPayrollService, PayrollPoolService, PayrollProcessor] })
export class PlanillasModule {}
