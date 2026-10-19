import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import type { CrearNovedadPlanillaDto, DetalleAsistenciaQueryDto, ResolverNovedadPlanillaDto } from '@jyp/shared-contracts';
import { CrearNovedadPlanillaSchema, DetalleAsistenciaQuerySchema, ResolverNovedadPlanillaSchema } from '@jyp/shared-contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiSwaggerCrearNovedadPlanilla, ApiSwaggerListarNovedadesPlanilla, ApiSwaggerPlanillasController, ApiSwaggerResolverNovedadPlanilla } from '../decorators/planillas-swagger.decorator';
import { CrearNovedadPlanillaUseCase } from '../use-case/novedades/crearNovedadPlanilla.useCase';
import { ListarNovedadesPlanillaUseCase } from '../use-case/novedades/listarNovedadesPlanilla.useCase';
import { ResolverNovedadPlanillaUseCase } from '../use-case/novedades/resolverNovedadPlanilla.useCase';

/** Acciones de usuario para novedades; cada operación delega en su caso de uso. */
@ApiSwaggerPlanillasController()
@Controller('api/payroll/planillas/novedades')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'CONTADOR', 'ASISTENTE')
export class NovedadesPlanillaController {
    constructor(private readonly crearNovedadPlanilla: CrearNovedadPlanillaUseCase, private readonly resolverNovedadPlanilla: ResolverNovedadPlanillaUseCase, private readonly listarNovedadesPlanilla: ListarNovedadesPlanillaUseCase) {}

    @Post()
    @ApiSwaggerCrearNovedadPlanilla()
    crearNovedad(@Body(new ZodValidationPipe(CrearNovedadPlanillaSchema)) dto: CrearNovedadPlanillaDto, @Req() req: SolicitudAutenticada) {
        return this.crearNovedadPlanilla.execute(dto, actorSolicitud(req));
    }

    @Post(':id/resolver')
    @ApiSwaggerResolverNovedadPlanilla()
    @Roles('CONTADOR')
    resolverNovedad(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ResolverNovedadPlanillaSchema)) dto: ResolverNovedadPlanillaDto, @Req() req: SolicitudAutenticada) {
        return this.resolverNovedadPlanilla.execute(id, dto, actorSolicitud(req));
    }

    @Get('listar')
    @ApiSwaggerListarNovedadesPlanilla()
    listarNovedades(@Query(new ZodValidationPipe(DetalleAsistenciaQuerySchema)) query: DetalleAsistenciaQueryDto) {
        return this.listarNovedadesPlanilla.execute(query.empleado_id, query.periodo);
    }
}
