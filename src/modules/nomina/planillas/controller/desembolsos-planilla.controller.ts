//src/modules/nomina/planillas/controller/desembolsos-planilla.controller.ts
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import type { RegistrarDesembolsoDto } from '@jyp/shared-contracts';
import { RegistrarDesembolsoSchema } from '@jyp/shared-contracts';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSwaggerPlanillasController, ApiSwaggerListarAdelantosPendientesDesembolso, ApiSwaggerRegistrarDesembolso } from '../decorators/planillas-swagger.decorator';
import { RegistrarDesembolsoUseCase } from '../use-case/desembolso/registrarDesembolso.useCase';
import { ListarAdelantosPendientesDesembolsoUseCase } from '../use-case/desembolso/listarAdelantosPendientesDesembolso.useCase';

/**
 * Controlador para manejar las operaciones de desembolso de planillas.
 * Este controlador expone un endpoint para registrar los desembolsos de planilla.
 * Se aplican guardias de autenticación y autorización para asegurar que solo usuarios con roles específicos puedan acceder a este recurso.
 * La validación de los datos de entrada se realiza mediante un esquema Zod.
 */
@ApiSwaggerPlanillasController()
@Controller('api/v1/nomina/planillas/desembolsos')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'CONTADOR', 'ASISTENTE')
export class DesembolsosPlanillaController {
    constructor(
        private readonly registrarDesembolso: RegistrarDesembolsoUseCase,
        private readonly listarAdelantosPendientes: ListarAdelantosPendientesDesembolsoUseCase
    ) {}

    /**
     * Endpoint para listar los adelantos aprobados que aún no tienen desembolso (PLA-F9).
     * @returns Una promesa que resuelve con los adelantos pendientes de desembolso.
     */
    @Get()
    @ApiSwaggerListarAdelantosPendientesDesembolso()
    @Roles('CONTADOR')
    listarPendientes() {
        return this.listarAdelantosPendientes.execute();
    }

    /**
     * Endpoint para registrar un desembolso de planilla.
     * @param dto - Objeto que contiene los datos necesarios para registrar el desembolso.
     * @param req - Solicitud autenticada que contiene información del usuario que realiza la operación.
     * @returns Una promesa que se resuelve con el resultado del registro del desembolso.
     * @throws Excepciones de validación si los datos de entrada no cumplen con el esquema definido.
     */
    @Post()
    @ApiSwaggerRegistrarDesembolso()
    @Roles('CONTADOR')
    desembolsar(@Body(new ZodValidationPipe(RegistrarDesembolsoSchema)) dto: RegistrarDesembolsoDto, @Req() req: SolicitudAutenticada) {
        return this.registrarDesembolso.execute(dto, actorSolicitud(req));
    }
}
