//src/modules/asistencia/controller/gestion-asistencia.controller.ts
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

/**
 * Controlador de gestión de asistencia, encargado de exponer los endpoints relacionados con la asistencia de los empleados.
 * Este controlador permite obtener detalles de asistencia, resolver decisiones de asistencia, asignar jornadas, guardar días de descanso y resolver incidencias relacionadas con la asistencia.
 * Las URIS de este controlador están protegidas por JWT y roles específicos, asegurando que solo usuarios autorizados puedan acceder a estas funcionalidades.
 * Las URIS implementadas son: 
 * - GET /api/asistencia/detalle-diario: Obtiene el detalle de asistencia diario de un empleado para un periodo específico.
 * - POST /api/asistencia/decisiones: Permite resolver decisiones de asistencia, como aprobar o rechazar solicitudes de asistencia.
 * - POST /api/asistencia/jornadas/asignar: Permite asignar una jornada específica a un empleado.
 * - POST /api/asistencia/calendario: Permite guardar días adicionales de descanso en el calendario de asistencia.
 * - POST /api/asistencia/incidencias/resolver: Permite resolver incidencias relacionadas con la asistencia de los empleados.
 */
@ApiSwaggerGestionAsistenciaController()
@Controller('api/v1/asistencia')
@UseGuards(JwtAccessGuard, RolesGuard)
export class GestionAsistenciaController {
    constructor(private readonly obtenerDetalleAsistencia: ObtenerDetalleAsistenciaUseCase, 
        private readonly resolverDiaAsistencia: ResolverDiaAsistenciaUseCase, 
        private readonly asignarJornadaAsistencia: AsignarJornadaAsistenciaUseCase, 
        private readonly guardarDescansoAsistencia: GuardarDescansoAsistenciaUseCase, 
        private readonly resolverIncidencia: ResolverIncidenciaUseCase
    ) {}

    /**
     * Obtiene el detalle de asistencia diario de un empleado para un periodo específico.
     * Este endpoint permite a los usuarios con roles ADMIN, RRHH, CONTADOR o ASISTENTE consultar el detalle de asistencia de un empleado en un periodo determinado.
     * El detalle de asistencia incluye información sobre las horas trabajadas, ausencias, permisos y cualquier otra incidencia registrada durante el periodo especificado.
     * @param query : DetalleAsistenciaQueryDto que contiene el ID del empleado y el periodo de consulta.
     * @param query : DetalleAsistenciaQueryDto {
     *   empleado_id: number;
     *   periodo: string;
     * }
     * @param req : SolicitudAutenticada que contiene la información del usuario autenticado que realiza la solicitud.
     * @param req : SolicitudAutenticada {
     *   user: {
     *     id: string;
     *     rol: string;
     *     }
     *   }
     * @uri /api/v1/asistencia/detalle-diario
     * @roles ADMIN, RRHH, CONTADOR, ASISTENTE
     * @returns - Un objeto que contiene el detalle de asistencia del empleado para el periodo especificado.
     * @throws - Error si el empleado no existe o si el periodo es inválido.
     * @throws - Error si el usuario autenticado no tiene los permisos necesarios para acceder a esta información.
     */
    @Get('detalle-diario')
    @ApiSwaggerDetalleAsistencia()
    @Roles('ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE')
    detalle(@Query(new ZodValidationPipe(DetalleAsistenciaQuerySchema)) query: DetalleAsistenciaQueryDto) {
        return this.obtenerDetalleAsistencia.execute(query.empleado_id, query.periodo);
    }

    /**
     * Permite resolver decisiones de asistencia, como aprobar o rechazar solicitudes de asistencia.
     * Este endpoint permite a los usuarios con roles ADMIN o RRHH tomar decisiones sobre solicitudes de asistencia presentadas por los empleados.
     * Las decisiones pueden incluir la aprobación o el rechazo de solicitudes de asistencia, así como la asignación de comentarios o notas adicionales relacionadas con la decisión tomada.
     * @param dto - ResolverDiaAsistenciaDto que contiene la información necesaria para resolver la decisión de asistencia.
     * @param dto - ResolverDiaAsistenciaDto {
     *   empleado_id: number;
     *   fecha: string;
     *   decision: 'APROBAR' | 'RECHAZAR';
     *   comentario?: string;
     * }
     * @url /api/v1/asistencia/decisiones
     * @roles ADMIN, RRHH
     * @param req - La solicitud autenticada que contiene la información del usuario.
     * @returns 
     */
    @Post('decisiones')
    @ApiSwaggerResolverDiaAsistencia()
    @Roles('ADMIN', 'RRHH')
    resolver(@Body(new ZodValidationPipe(ResolverDiaAsistenciaSchema)) dto: ResolverDiaAsistenciaDto, @Req() req: SolicitudAutenticada) {
        return this.resolverDiaAsistencia.execute(dto, actorSolicitud(req));
    }

    /**
     * Permite asignar una jornada específica a un empleado.
     * Este endpoint permite a los usuarios con roles ADMIN o RRHH asignar una jornada laboral específica a un empleado, estableciendo la vigencia histórica de la jornada.
     * La jornada asignada puede incluir información sobre el horario de trabajo, los días laborables y cualquier otra configuración relevante para la jornada del empleado.
     * @url /api/v1/asistencia/jornadas/asignar
     * @roles ADMIN, RRHH
     * @param dto - AsignarJornadaAsistenciaDto que contiene la información necesaria para asignar la jornada al empleado.
     * @param req 
     * @returns 
     */
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
