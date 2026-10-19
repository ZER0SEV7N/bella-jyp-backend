import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import type { RegistrarDesembolsoDto } from '@jyp/shared-contracts';
import { RegistrarDesembolsoSchema } from '@jyp/shared-contracts';
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSwaggerPlanillasController, ApiSwaggerRegistrarDesembolso } from '../decorators/planillas-swagger.decorator';
import { RegistrarDesembolsoUseCase } from '../use-case/desembolso/registrarDesembolso.useCase';

/** Acciones de usuario para desembolsos; cada operación delega en su caso de uso. */
@ApiSwaggerPlanillasController()
@Controller('api/payroll/planillas/desembolsos')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'CONTADOR', 'ASISTENTE')
export class DesembolsosPlanillaController {
    constructor(private readonly registrarDesembolso: RegistrarDesembolsoUseCase) {}

    @Post()
    @ApiSwaggerRegistrarDesembolso()
    @Roles('CONTADOR')
    desembolsar(@Body(new ZodValidationPipe(RegistrarDesembolsoSchema)) dto: RegistrarDesembolsoDto, @Req() req: SolicitudAutenticada) {
        return this.registrarDesembolso.execute(dto, actorSolicitud(req));
    }
}
