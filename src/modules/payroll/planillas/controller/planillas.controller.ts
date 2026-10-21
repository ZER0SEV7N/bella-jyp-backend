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
     * @param dto 
     * @param req 
     * @returns 
     */
    @Post('generar')
    @ApiSwaggerGenerarPlanillas()
    @HttpCode(202)
    generar(@Body(new ZodValidationPipe(GenerarPlanillasSchema)) dto: GenerarPlanillasDto, @Req() req: SolicitudAutenticada) {
        return this.solicitarGeneracionPlanillas.execute(dto, actorSolicitud(req));
    }

    @Get('trabajos/:id')
    @ApiSwaggerConsultarTrabajoPlanillas()
    consultar(@Param('id') id: string, @Req() req: SolicitudAutenticada) {
        return this.consultarTrabajoPlanillas.execute(id, actorSolicitud(req), req.user.rol);
    }

    @Get()
    @ApiSwaggerListarPlanillas()
    listar(@Query(new ZodValidationPipe(ListarPlanillasSchema)) query: ListarPlanillasDto) {
        return this.listarPlanillas.execute(query);
    }

    @Get(':id')
    @ApiSwaggerObtenerPlanilla()
    detalle(@Param('id', ParseUUIDPipe) id: string) {
        return this.obtenerPlanilla.execute(id);
    }

    @Get(':id/boleta')
    @ApiSwaggerDescargarBoleta()
    async boleta(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
        const archivo = await this.descargarBoleta.execute(id);
        return reply.type('application/pdf').header('content-disposition', `attachment; filename="${archivo.nombre}"`).send(archivo.stream);
    }

    //El asistente prepara la información; solo el contador valida la nómina.
    @Post(':id/congelar')
    @ApiSwaggerCongelarPlanilla()
    @Roles('CONTADOR')
    congelar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CongelarPlanillaSchema)) dto: CongelarPlanillaDto, @Req() req: SolicitudAutenticada) {
        return this.congelarPlanilla.execute(id, dto, actorSolicitud(req));
    }
}
