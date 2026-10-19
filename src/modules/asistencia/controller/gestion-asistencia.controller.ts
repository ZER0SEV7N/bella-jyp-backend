import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { AsignarJornadaAsistenciaDto, DetalleAsistenciaQueryDto, DiaAdicionalCalendarioDto, ResolverDiaAsistenciaDto, ResolverIncidenciaDto } from '@jyp/shared-contracts';
import { AsignarJornadaAsistenciaSchema, DetalleAsistenciaQuerySchema, DiaAdicionalCalendarioSchema, ResolverDiaAsistenciaSchema, ResolverIncidenciaSchema } from '@jyp/shared-contracts';
import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiSwaggerAsignarJornadaAsistencia, ApiSwaggerDetalleAsistencia, ApiSwaggerGestionAsistenciaController, ApiSwaggerGuardarDescansoAsistencia, ApiSwaggerResolverDiaAsistencia, ApiSwaggerResolverIncidencia } from '../decorator/gestion-asistencia-swagger.decorator';
import { AsignarJornadaAsistenciaUseCase } from '../use-cases/asistencias/asignarJornadaAsistencia.useCase';
import { GuardarDescansoAsistenciaUseCase } from '../use-cases/asistencias/guardarDescansoAsistencia.useCase';
import { ObtenerDetalleAsistenciaUseCase } from '../use-cases/asistencias/obtenerDetalleAsistencia.useCase';
import { ResolverDiaAsistenciaUseCase } from '../use-cases/asistencias/resolverDiaAsistencia.useCase';
import { ResolverIncidenciaUseCase } from '../use-cases/Incidencias/resolverIncidencia.useCase';

import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';

@ApiSwaggerGestionAsistenciaController()
@Controller('api/asistencia')
@UseGuards(JwtAccessGuard, RolesGuard)
export class GestionAsistenciaController {
    constructor(private readonly obtenerDetalleAsistencia: ObtenerDetalleAsistenciaUseCase, private readonly resolverDiaAsistencia: ResolverDiaAsistenciaUseCase, private readonly asignarJornadaAsistencia: AsignarJornadaAsistenciaUseCase, private readonly guardarDescansoAsistencia: GuardarDescansoAsistenciaUseCase, private readonly resolverIncidencia: ResolverIncidenciaUseCase) {}

    @Get('detalle-diario')
    @ApiSwaggerDetalleAsistencia()
    @Roles('ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE')
    detalle(@Query(new ZodValidationPipe(DetalleAsistenciaQuerySchema)) query: DetalleAsistenciaQueryDto) {
        return this.obtenerDetalleAsistencia.execute(query.empleado_id, query.periodo);
    }

    //Toda decisión exige un motivo; el trigger conserva su auditoría en la misma transacción.
    @Post('decisiones')
    @ApiSwaggerResolverDiaAsistencia()
    @Roles('ADMIN', 'RRHH')
    resolver(@Body(new ZodValidationPipe(ResolverDiaAsistenciaSchema)) dto: ResolverDiaAsistenciaDto, @Req() req: SolicitudAutenticada) {
        return this.resolverDiaAsistencia.execute(dto, actorSolicitud(req));
    }

    @Post('jornadas/asignar')
    @ApiSwaggerAsignarJornadaAsistencia()
    @Roles('ADMIN', 'RRHH')
    asignar(@Body(new ZodValidationPipe(AsignarJornadaAsistenciaSchema)) dto: AsignarJornadaAsistenciaDto, @Req() req: SolicitudAutenticada) {
        return this.asignarJornadaAsistencia.execute(dto, actorSolicitud(req));
    }

    @Post('calendario')
    @ApiSwaggerGuardarDescansoAsistencia()
    @Roles('ADMIN', 'RRHH')
    calendario(@Body(new ZodValidationPipe(DiaAdicionalCalendarioSchema)) dto: DiaAdicionalCalendarioDto, @Req() req: SolicitudAutenticada) {
        return this.guardarDescansoAsistencia.execute(dto, actorSolicitud(req));
    }

    @Post('incidencias/resolver')
    @ApiSwaggerResolverIncidencia()
    @Roles('ADMIN', 'RRHH')
    revisar(@Body(new ZodValidationPipe(ResolverIncidenciaSchema)) dto: ResolverIncidenciaDto, @Req() req: SolicitudAutenticada) {
        return this.resolverIncidencia.execute(dto, actorSolicitud(req));
    }
}
