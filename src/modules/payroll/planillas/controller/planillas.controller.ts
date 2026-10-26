//src/modules/payroll/planillas/controller/planillas.controller.ts
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import type { CongelarPlanillaDto, GenerarPlanillasDto, ListarPlanillasDto } from '@jyp/shared-contracts';
import { CongelarPlanillaSchema, GenerarPlanillasSchema, ListarPlanillasSchema } from '@jyp/shared-contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiSwaggerCongelarPlanilla, ApiSwaggerConsultarTrabajoPlanillas, ApiSwaggerDescargarBoleta, ApiSwaggerGenerarPlanillas, ApiSwaggerListarPlanillas, ApiSwaggerObtenerPlanilla, ApiSwaggerPlanillasController } from '../decorators/planillas-swagger.decorator';
import { CongelarPlanillaUseCase } from '../use-case/planillas/congelarPlanilla.useCase';
import { ConsultarTrabajoPlanillasUseCase } from '../use-case/planillas/consultarJobPlanillas.useCase';
import { DescargarBoletaUseCase } from '../use-case/descargarBoleta.useCase';
import { ListarPlanillasUseCase } from '../use-case/planillas/listarPlanilla.useCase';
import { ObtenerPlanillaUseCase } from '../use-case/planillas/obtenerPlanilla.useCase';
import { SolicitarGeneracionPlanillasUseCase } from '../use-case/solicitarGeneracionPlanilla.useCase';

/**
 * Controlador de la API REST para la gestión de planillas de pago.
 * Proporciona endpoints para generar, consultar, listar y descargar planillas y boletas de pago.
 * Se aplican guardias de autenticación y autorización para proteger los recursos según el rol del usuario.
 * endpoints: 
 * - POST /api/v1/payroll/planillas/generar: Solicita la generación de una nueva planilla.
 * - GET /api/v1/payroll/planillas/trabajos/:id: Consulta el estado de un trabajo de generación de planilla.
 * - GET /api/v1/payroll/planillas: Lista las planillas existentes según filtros opcionales.
 * - GET /api/v1/payroll/planillas/:id: Obtiene los detalles de una planilla específica.
 * - GET /api/v1/payroll/planillas/:id/boleta: Descarga la boleta de pago de una planilla específica.
 * - POST /api/v1/payroll/planillas/:id/congelar: Congela una planilla para su validación final (solo para contadores).
 * Cada endpoint delega la lógica de negocio a su respectivo caso de uso, que encapsula las reglas y operaciones necesarias.
 * La validación de los datos de entrada se realiza mediante esquemas Zod y pipes de validación personalizados.
 * La auditoría de las operaciones se registra utilizando el actor que realiza la solicitud, incluyendo su ID y dirección IP.
 */
@Controller('api/v1/payroll/planillas')
@ApiSwaggerPlanillasController()
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'CONTADOR', 'ASISTENTE')
export class PlanillasController {
    constructor(private readonly solicitarGeneracionPlanillas: SolicitarGeneracionPlanillasUseCase, 
        private readonly consultarTrabajoPlanillas: ConsultarTrabajoPlanillasUseCase, 
        private readonly listarPlanillas: ListarPlanillasUseCase, 
        private readonly obtenerPlanilla: ObtenerPlanillaUseCase, 
        private readonly descargarBoleta: DescargarBoletaUseCase,
        private readonly congelarPlanilla: CongelarPlanillaUseCase
    ) {}

    /**
     * Endpoint para solicitar la generación de una nueva planilla de pago.
     * @Post /api/v1/payroll/planillas/generar
     * @roles 'ADMIN', 'CONTADOR', 'ASISTENTE' - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param dto - Objeto que contiene los datos necesarios para generar la planilla.
     * @Dto : GenerarPlanillasDto {
     *  - periodo: PeriodoAsistenciaSchema; // Periodo de asistencia para el cual se generará la planilla
     *  - solicitud_id: string; // ID de la solicitud asociada a la generación de la planilla
     *  - empleado_id?: string; // ID del empleado para generar la planilla individual (opcional)
     *  - area_id?: string; // ID del área para generar la planilla por área (opcional) 
     * }
     * @param req - Solicitud autenticada que contiene información del usuario que realiza la operación.
     * @returns Una promesa que se resuelve con el resultado de la solicitud de generación de planilla.
     * @throws Excepciones de validación si los datos de entrada no cumplen con el esquema definido.
     */
    @Post('generar')
    @ApiSwaggerGenerarPlanillas()
    @HttpCode(202)
    generar(@Body(new ZodValidationPipe(GenerarPlanillasSchema)) dto: GenerarPlanillasDto, @Req() req: SolicitudAutenticada) {
        return this.solicitarGeneracionPlanillas.execute(dto, actorSolicitud(req));
    }

    /**
     * Endpoint para consultar el estado de un trabajo de generación de planilla.
     * @Get /api/v1/payroll/planillas/trabajos/:id
     * @roles 'ADMIN', 'CONTADOR', 'ASISTENTE' - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param id - ID del trabajo de generación de planilla a consultar.
     * @param req - Solicitud autenticada que contiene información del usuario que realiza la operación.
     * @returns Una promesa que se resuelve con el estado del trabajo de generación de planilla.
     * @throws Excepciones de validación si el ID proporcionado no es válido o si el trabajo no existe.
     */
    @Get('trabajos/:id')
    @ApiSwaggerConsultarTrabajoPlanillas()
    consultar(@Param('id') id: string, @Req() req: SolicitudAutenticada) {
        return this.consultarTrabajoPlanillas.execute(id, actorSolicitud(req), req.user.rol);
    }

    /**
     * Endpoint para listar las planillas de pago existentes según filtros opcionales.
     * @Get /api/v1/payroll/planillas
     * @roles 'ADMIN', 'CONTADOR', 'ASISTENTE' - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param query - Objeto que contiene los filtros opcionales para listar las planillas.
     * @Dto : ListarPlanillasDto {
     *  - periodo?: PeriodoAsistenciaSchema; // Periodo de asistencia para filtrar las planillas (opcional)
     *  - page?: number; // Número de página para la paginación (opcional, por defecto 1)
     *  - limit?: number; // Cantidad de planillas por página para la paginación (opcional, por defecto 20)
     * }
     * @param req - Solicitud autenticada que contiene información del usuario que realiza la operación.
     * @returns Una promesa que se resuelve con la lista de planillas según los filtros proporcionados.
     * @throws Excepciones de validación si los datos de entrada no cumplen con el esquema definido.
     */
    @Get()
    @ApiSwaggerListarPlanillas()
    listar(@Query(new ZodValidationPipe(ListarPlanillasSchema)) query: ListarPlanillasDto) {
        return this.listarPlanillas.execute(query);
    }

    /**
     * Endpoint para obtener los detalles de una planilla de pago específica.
     * @Get /api/v1/payroll/planillas/:id
     * @roles 'ADMIN', 'CONTADOR', 'ASISTENTE' - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param id - ID de la planilla de pago a obtener.
     * @returns Una promesa que se resuelve con los detalles de la planilla de pago especificada.
     * @throws Excepciones de validación si el ID proporcionado no es válido o si la planilla no existe.
     */
    @Get(':id')
    @ApiSwaggerObtenerPlanilla()
    detalle(@Param('id', ParseUUIDPipe) id: string) {
        return this.obtenerPlanilla.execute(id);
    }

    /**
     * Endpoint para descargar la boleta de pago de una planilla específica.
     * @Get /api/v1/payroll/planillas/:id/boleta
     * @roles 'ADMIN', 'CONTADOR', 'ASISTENTE' - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param id - ID de la planilla de pago cuya boleta se desea descargar.
     * @param reply - Objeto de respuesta de Fastify para enviar el archivo PDF de la boleta.
     * @returns Una promesa que se resuelve con el archivo PDF de la boleta de pago.
     * @throws Excepciones de validación si el ID proporcionado no es válido o si la boleta no existe.
     */
    @Get(':id/boleta')
    @ApiSwaggerDescargarBoleta()
    async boleta(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
        const archivo = await this.descargarBoleta.execute(id);
        return reply.type('application/pdf').header('content-disposition', `attachment; filename="${archivo.nombre}"`).send(archivo.stream);
    }

    /**
     * Endpoint para congelar una planilla de pago específica, marcándola como finalizada y lista para su validación.
     * @Post /api/v1/payroll/planillas/:id/congelar
     * @roles 'CONTADOR' - Solo usuarios con el rol de CONTADOR pueden acceder a este endpoint.
     * @param id - ID de la planilla de pago que se desea congelar.
     * @param dto - Objeto que contiene los datos necesarios para congelar la planilla.
     * @Dto : CongelarPlanillaDto {
     *   - motivo: string; // Motivo por el cual se congela la planilla
     *   - fecha_congelacion: string; // Fecha en la que se congela la planilla (formato ISO 8601)
     *   - observaciones?: string; // Observaciones adicionales sobre la congelación de la planilla (opcional)
     * }
     * @param req - Solicitud autenticada que contiene información del usuario que realiza la operación.
     * @returns Una promesa que se resuelve con el resultado de la operación de congelación de la planilla.
     * @throws Excepciones de validación si los datos de entrada no cumplen con el esquema definido o si el usuario no tiene permisos para congelar la planilla.
     */
    @Post(':id/congelar')
    @ApiSwaggerCongelarPlanilla()
    @Roles('CONTADOR')
    congelar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CongelarPlanillaSchema)) dto: CongelarPlanillaDto, @Req() req: SolicitudAutenticada) {
        return this.congelarPlanilla.execute(id, dto, actorSolicitud(req));
    }
}
