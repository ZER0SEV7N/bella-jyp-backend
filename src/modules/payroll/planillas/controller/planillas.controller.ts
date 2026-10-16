//src/modules/payroll/planillas/controller/planillas.controller.ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { CongelarPlanillaSchema, GenerarPlanillasSchema, ListarPlanillasSchema, RegistrarDesembolsoSchema, CrearNovedadPlanillaSchema, ResolverNovedadPlanillaSchema, DetalleAsistenciaQuerySchema  } from '@jyp/shared-contracts';
import type { CongelarPlanillaDto, GenerarPlanillasDto, ListarPlanillasDto, RegistrarDesembolsoDto, CrearNovedadPlanillaDto, ResolverNovedadPlanillaDto, DetalleAsistenciaQueryDto } from '@jyp/shared-contracts';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { actorSolicitud } from '@/modules/asistencia/controller/gestion-asistencia.controller';
import type { SolicitudAutenticada } from '@/modules/asistencia/controller/gestion-asistencia.controller';
import { PlanillasService } from '../services/planillas.service';
import { ColaPayrollService } from '../services/cola-payroll.service';
import { NovedadesPlanillaService } from '../services/novedades-planilla.service';
import { BoletasService } from '../services/boletas.service';

/**
 * Controlador de la API REST para la gestión de planillas de pago.
 * Proporciona endpoints para generar, consultar, listar y descargar planillas y boletas de pago.
 * Se aplican guardias de autenticación y autorización para proteger los recursos según el rol del usuario.
 */
@Controller('api/v1/payroll/planillas')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'CONTADOR', 'ASISTENTE')
export class PlanillasController {
    constructor(private readonly planillas: PlanillasService, private readonly cola: ColaPayrollService, private readonly novedades: NovedadesPlanillaService, private readonly boletas: BoletasService) {}

    //HTTP 202 indica que el trabajo fue aceptado; el resultado se consulta por su identificador.
    @Post('generar')
    @HttpCode(202)
    generar(@Body(new ZodValidationPipe(GenerarPlanillasSchema)) dto: GenerarPlanillasDto, @Req() req: SolicitudAutenticada) { return this.cola.encolar(dto, actorSolicitud(req)); }

    @Get('trabajos/:id')
    consultar(@Param('id') id: string, @Req() req: SolicitudAutenticada) { return this.cola.consultar(id, actorSolicitud(req), req.user.rol); }

    @Get()
    listar(@Query(new ZodValidationPipe(ListarPlanillasSchema)) query: ListarPlanillasDto) { return this.planillas.listar(query); }

    @Post('desembolsos')
    @Roles('CONTADOR')
    desembolsar(@Body(new ZodValidationPipe(RegistrarDesembolsoSchema)) dto: RegistrarDesembolsoDto, @Req() req: SolicitudAutenticada) { return this.planillas.registrarDesembolso(dto, actorSolicitud(req)); }

    @Get(':id')
    detalle(@Param('id', ParseUUIDPipe) id: string) { return this.planillas.detalle(id); }

    @Get(':id/boleta')
    async boleta(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
        const archivo = await this.boletas.descargar(id);
        return reply.type('application/pdf').header('content-disposition', `attachment; filename="${archivo.nombre}"`).send(archivo.stream);
    }

    @Post('novedades')
    crearNovedad(@Body(new ZodValidationPipe(CrearNovedadPlanillaSchema)) dto: CrearNovedadPlanillaDto, @Req() req: SolicitudAutenticada) { return this.novedades.crear(dto, actorSolicitud(req)); }

    @Post('novedades/:id/resolver')
    @Roles('CONTADOR')
    resolverNovedad(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ResolverNovedadPlanillaSchema)) dto: ResolverNovedadPlanillaDto, @Req() req: SolicitudAutenticada) { return this.novedades.resolver(id, dto, actorSolicitud(req)); }

    @Get('novedades/listar')
    listarNovedades(@Query(new ZodValidationPipe(DetalleAsistenciaQuerySchema)) query: DetalleAsistenciaQueryDto) { return this.novedades.listar(query.empleado_id, query.periodo); }

    //El asistente prepara la información; solo el contador valida la nómina.
    @Post(':id/congelar')
    @Roles('CONTADOR')
    congelar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CongelarPlanillaSchema)) dto: CongelarPlanillaDto, @Req() req: SolicitudAutenticada) { return this.planillas.congelar(id, dto, actorSolicitud(req)); }
}
