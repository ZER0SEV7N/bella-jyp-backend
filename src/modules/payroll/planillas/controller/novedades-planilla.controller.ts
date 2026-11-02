//src/modules/payroll/planillas/controller/novedades-planilla.controller.ts
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

/**
 * Controlador para manejar las operaciones relacionadas con las novedades de planilla.
 * Este controlador expone endpoints para crear, resolver y listar novedades de planilla.
 * Se aplican guardias de autenticación y autorización para asegurar que solo usuarios con roles específicos puedan acceder a estos recursos.
 * La validación de los datos de entrada se realiza mediante esquemas Zod y pipes de validación personalizados.
 * Endpoints :
 *  - POST /api/v1/payroll/planillas/novedades: Crea una nueva novedad de planilla.
 *  - POST /api/v1/payroll/planillas/novedades/:id/resolver: Resuelve una novedad de planilla existente.
 *  - GET /api/v1/payroll/planillas/novedades/listar: Lista las novedades de planilla según filtros opcionales.
 * Cada endpoint delega la lógica de negocio a su respectivo caso de uso, que encapsula las reglas y operaciones necesarias.
 * La auditoría de las operaciones se registra utilizando el actor que realiza la solicitud, incluyendo su ID y dirección IP.
 */
@ApiSwaggerPlanillasController()
@Controller('api/v1/payroll/planillas/novedades')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'CONTADOR', 'ASISTENTE')
export class NovedadesPlanillaController {
    constructor(private readonly crearNovedadPlanilla: CrearNovedadPlanillaUseCase, private readonly resolverNovedadPlanilla: ResolverNovedadPlanillaUseCase, private readonly listarNovedadesPlanilla: ListarNovedadesPlanillaUseCase) {}

    /**
     * Endpoint para crear una nueva novedad de planilla.
     * @Post /api/v1/payroll/planillas/novedades
     * @param dto - Objeto que contiene los datos necesarios para crear la novedad.
     * @Roles 'ADMIN', 'CONTADOR', 'ASISTENTE' - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @Dto : CrearNovedadPlanillaDto {
     *  - empleado_id: string; // ID del empleado al que se le asigna la novedad
     *  - tipo: ENUM ['BONO_EXTRAORDINARIO_REMUNERATIVO', 'DESCUENTO_AUTORIZADO', 'DESCUENTO_DSO']; // Tipo de novedad
     *  - monto: string; // Monto de la novedad, debe ser una cadena decimal con hasta cuatro decimales
     *  - motivo: string; // Motivo de la novedad, entre 5 y 1000 caracteres
     *  - referencia_evidencia: string; // Referencia o evidencia de la novedad, entre 3 y 255 caracteres
     *  - periodo: PeriodoAsistenciaSchema; // Periodo de asistencia al que corresponde la novedad
     * }
     * @param req - Solicitud autenticada que contiene información del usuario que realiza la operación.
     * @returns Una promesa que se resuelve con el resultado de la creación de la novedad.
     * @throws Excepciones de validación si los datos de entrada no cumplen con el esquema definido.
     */
    @Post()
    @ApiSwaggerCrearNovedadPlanilla()
    crearNovedad(@Body(new ZodValidationPipe(CrearNovedadPlanillaSchema)) dto: CrearNovedadPlanillaDto, @Req() req: SolicitudAutenticada) {
        return this.crearNovedadPlanilla.execute(dto, actorSolicitud(req));
    }

    /**
     * Endpoint para resolver una novedad de planilla existente.
     * @Post /api/v1/payroll/planillas/novedades/:id/resolver
     * @Roles 'CONTADOR' - Solo usuarios con este rol pueden acceder a este endpoint.
     * @param id - ID de la novedad de planilla a resolver.
     * @param dto - Objeto que contiene los datos necesarios para resolver la novedad.
     * @Dto : ResolverNovedadPlanillaDto {
     *  - version: number; // Versión de la novedad a resolver, debe ser un número entero positivo
     *  - estado: ENUM ['APROBADO', 'RECHAZADO', 'ANULADO']; // Nuevo estado de la novedad
     *  - motivo: string; // Motivo de la resolución, entre 5 y 1000 caracteres
     * }
     * @param req - Solicitud autenticada que contiene información del usuario que realiza la operación.
     * @returns Una promesa que se resuelve con el resultado de la resolución de la novedad.
     * @throws Excepciones de validación si los datos de entrada no cumplen con el esquema definido.
     */
    @Post(':id/resolver')
    @ApiSwaggerResolverNovedadPlanilla()
    @Roles('CONTADOR')
    resolverNovedad(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ResolverNovedadPlanillaSchema)) dto: ResolverNovedadPlanillaDto, @Req() req: SolicitudAutenticada) {
        return this.resolverNovedadPlanilla.execute(id, dto, actorSolicitud(req));
    }

    /**
     * Endpoint para listar las novedades de planilla según filtros opcionales.
     * @Get /api/v1/payroll/planillas/novedades/listar
     * @Roles 'ADMIN', 'CONTADOR', 'ASISTENTE' - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param query - Objeto que contiene los filtros para listar las novedades.
     * @Query : DetalleAsistenciaQueryDto {
     *  - empleado_id: string (opcional);
     *  - periodo: PeriodoAsistenciaSchema (opcional);
     *  - page: number (opcional, por defecto 1);
     *  - limit: number (opcional, por defecto 20, máximo 100);
     * }
     * @returns Una promesa que se resuelve con la lista de novedades de planilla que cumplen con los filtros especificados.
     * @throws Excepciones de validación si los datos de entrada no cumplen con el esquema definido.
     */
    @Get('listar')
    @ApiSwaggerListarNovedadesPlanilla()
    listarNovedades(@Query(new ZodValidationPipe(DetalleAsistenciaQuerySchema)) query: DetalleAsistenciaQueryDto) {
        return this.listarNovedadesPlanilla.execute(query.empleado_id, query.periodo);
    }
}
