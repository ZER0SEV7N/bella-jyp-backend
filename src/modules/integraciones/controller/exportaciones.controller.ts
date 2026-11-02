//src/modules/integraciones/controller/exportaciones.controller.ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {  SolicitarExportacionSchema, type SolicitarExportacionDto} from '@jyp/shared-contracts';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { actorSolicitud, type SolicitudAutenticada} from '@/common/utils/actor-operacion.util';
import { CrearTrabajoIntegracionUseCase } from '../use-cases/crearTrabajoIntegracion.useCase';
import { ConsultarTrabajoIntegracionUseCase } from '../use-cases/consultarTrabajoIntegracion.useCase';

/**
 * Controlador para manejar las solicitudes de exportación y consulta de trabajos de integración con el servicio externo de N8N.
 * Este controlador expone endpoints para solicitar la creación de trabajos de integración, consultar el estado de los trabajos 
 * y descargar archivos generados por N8N. También aplica validaciones de seguridad y autorización mediante JWT y roles.
 */
@Controller('api/v1/integraciones')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'CONTADOR')
export class ExportacionesController {
    constructor(
        private readonly crear: CrearTrabajoIntegracionUseCase,
        private readonly consultar: ConsultarTrabajoIntegracionUseCase
    ) {}

    /**
     * Endpoint para solicitar la creación de un trabajo de integración con el servicio externo de N8N.
     * Este endpoint recibe un DTO con los parámetros de la solicitud de exportación y la información del actor que realiza la operación.
     * @Post /api/v1/integraciones/exportaciones
     * @HttpCode 202 - Indica que la solicitud ha sido aceptada para su procesamiento.
     * @Body - Valida el DTO de solicitud de exportación mediante un ZodValidationPipe.
     * @param dto : {
     *   - tipo: 'PLAME', 'AFPNET', 'BCP_HABERES', 'BBVA_HABERES', 'INTERBANK_HABERES', 'COSTOS', 'BOLETAS',
     *   - periodo: string | null,
     *   - empleado_id: string | null,
     *   - area_id: string | null,
     *   - idempotencia: string, // clave única para garantizar que la solicitud no se duplique.
     *   - configuracion: {
     *     - confirmar_montos_pagados?: boolean,
     *     - fecha_pago?: string,
     *     - cuenta_cargo?: string,
     *     - tipo_cuenta_cargo?: 'C' | 'M',
     *     - referencia?: string,
     *     - tipos_cuenta_abono?: Record<string, 'A' | 'C' | 'M' | 'B'>,
     *     - apellidos_afpnet?: Record<string, { paterno: string, materno: string }>,
     *     - conceptos_plame?: Record<string, string>,
     *     - aportes_voluntarios?: Record<string, { con_fin: string, sin_fin: string, empleador: string }>
     *   }
     * }
     * @param req - Solicitud autenticada que contiene la información del usuario que realiza la operación.
     * @returns - Un resumen del trabajo de integración creado, incluyendo su ID, tipo, estado y periodo.
     */
    @Post('exportaciones')
    @HttpCode(202)
    solicitar(@Body(new ZodValidationPipe(SolicitarExportacionSchema)) dto: SolicitarExportacionDto,@Req() req: SolicitudAutenticada) {
        return this.crear.execute(dto, actorSolicitud(req));
    }

    /**
     * Endpoint para consultar el estado de un trabajo de integración por su ID.
     * Este endpoint devuelve un resumen del trabajo de integración, incluyendo su ID, tipo, estado, periodo y si requiere revisión.
     * @Get /api/v1/integraciones/trabajos/:id
     * @param id - El ID del trabajo de integración a consultar, validado como UUID mediante ParseUUIDPipe.
     * @returns - Un resumen del trabajo de integración, incluyendo su ID, tipo, estado, periodo y si requiere revisión.
     * @throws NotFoundException - Si el trabajo no existe.
     * @throws ConflictException - Si el trabajo está en un estado que no permite la consulta de archivos.
     */
    @Get('trabajos/:id')
    estado(@Param('id', ParseUUIDPipe) id: string) {
        return this.consultar.execute(id);
    }

    /**
     * Endpoint para consultar un archivo específico de un trabajo de integración por su ID y nombre.
     * Este endpoint devuelve un stream del archivo, su nombre y tipo MIME, y lo envía como respuesta HTTP con el encabezado de disposición de contenido para descarga.
     * @Get /api/v1/integraciones/trabajos/:id/archivos/:nombre
     * @param id - El ID del trabajo de integración, validado como UUID mediante ParseUUIDPipe.
     * @param nombre - El nombre del archivo a consultar.
     * @param reply - Objeto de respuesta FastifyReply para enviar el archivo como respuesta HTTP.
     * @returns - Un objeto que contiene un stream del archivo, su nombre y tipo MIME.
     * @throws NotFoundException - Si el trabajo o el archivo no existen.
     * @throws ConflictException - Si el trabajo no tiene archivos completos o si hay problemas de integridad con el archivo.
     */
    @Get('trabajos/:id/archivos/:nombre')
    async archivo( @Param('id', ParseUUIDPipe) id: string, @Param('nombre') nombre: string, @Res() reply: FastifyReply) {
        const archivo = await this.consultar.archivo(id, nombre);
        
        // Se envía el archivo como respuesta HTTP con el tipo MIME y el encabezado de disposición de contenido para descarga.
        return reply
            .type(archivo.tipo)
            .header( 'content-disposition', `attachment; filename="${archivo.nombre}"` )
            .send(archivo.stream);
    }
}
