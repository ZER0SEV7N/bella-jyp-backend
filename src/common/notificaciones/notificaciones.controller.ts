//src/common/notificaciones/notificaciones.controller.ts
import { NotificacionSchema } from '@jyp/shared-contracts';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { ApiOperacionDocumentada, esquemaContrato } from '@/common/decorators/api-contrato.decorator';
import { NotificacionesService } from './notificaciones.service';

/**
 * Controlador de notificaciones que expone un endpoint para listar el historial de alertas del rol autenticado.
 * Este controlador utiliza el servicio NotificacionesService para recuperar las alertas almacenadas en Redis y filtrarlas según el rol del usuario.
 */
@Controller('api/v1/notificaciones')
@UseGuards(JwtAccessGuard)
@ApiTags('Notificaciones')
@ApiBearerAuth('JWT-auth')
export class NotificacionesController {
    constructor(private readonly notificaciones: NotificacionesService) {}
  
    /**
     * Endpoint GET para listar el historial de alertas del rol autenticado.
     * Recupera hasta 50 alertas de los últimos 90 días para el rol del usuario autenticado.
     * @param req - Requiere del Fastify
     * @returns - Un arreglo de objetos Notificacion que representan las alertas recientes para el rol especificado.
     */
    @Get()
    @ApiOperacionDocumentada({
        summary: 'Historial de alertas del rol autenticado',
        description: 'Hasta 50 alertas de los últimos 90 días.',
        roles: [],
        respuesta: { type: 'array', items: esquemaContrato(NotificacionSchema) },
    })
    listar(@Req() req: FastifyRequest & { user: { rol: string } }) {
        return this.notificaciones.listar(req.user.rol);
    }
}
