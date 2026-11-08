//src/modules/nomina/planillas/controller/boletas-propias.controller.ts
import { Controller, Get, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { BoletasPropiasUseCase } from '../use-case/boletasPropias.useCase';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiSwaggerMisBoletas, ApiSwaggerDescargarBoleta } from '../decorators/planillas-swagger.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

/**
 * Controlador para manejar las solicitudes relacionadas con las boletas propias de un colaborador.
 * Proporciona endpoints para listar las boletas y descargar el archivo PDF de una boleta específica.
 * Se asegura de que el usuario autenticado solo pueda acceder a sus propias boletas mediante la verificación de pertenencia.
 * Utiliza JWT para la autenticación y Swagger para la documentación de la API.
 * Endpoints:
 * - GET /api/v1/nomina/mis-boletas: Lista las boletas propias del usuario autenticado.
 * - GET /api/v1/nomina/mis-boletas/:id/pdf: Descarga el archivo PDF de una boleta específica.
 */
@Controller('api/v1/nomina/mis-boletas')
@UseGuards(JwtAccessGuard, RolesGuard)
export class BoletasPropiasController {
    constructor(private readonly boletas: BoletasPropiasUseCase) {}

    /**
     * Lista las boletas propias del usuario autenticado, filtrando por estado y asegurando que solo se devuelvan boletas pertenecientes al usuario.
     * @Get /api/v1/payroll/mis-boletas
     * @param req - La solicitud autenticada que contiene la información del usuario.
     * @returns - Una promesa que resuelve con un arreglo de boletas, cada una con su ID, periodo, neto a pagar y estado.
     */
    @ApiSwaggerMisBoletas()
    @Get()
    @Roles('EMPLEADO')
    listar(@Req() req: SolicitudAutenticada) {
        return this.boletas.listar(req.user.id);
    }

    /**
     * Descarga el archivo PDF de una boleta específica, asegurando que la boleta pertenece al usuario y que existe.
     * @Get /api/v1/payroll/mis-boletas/:id/pdf
     * @param id - El ID de la boleta que se desea descargar, validado como UUID.
     * @param req - La solicitud autenticada que contiene la información del usuario.
     * @param reply - La respuesta de Fastify utilizada para enviar el archivo PDF al cliente.
     * @returns 
     */
    @ApiSwaggerDescargarBoleta()
    @Get(':id/pdf')
    @Roles('EMPLEADO')
    async archivo(@Param('id', ParseUUIDPipe) id: string, @Req() req: SolicitudAutenticada, @Res() reply: FastifyReply) {
        const archivo = await this.boletas.archivo(id, req.user.id);
        return reply
            .type('application/pdf')
            .header(
                'content-disposition',
                `attachment; filename="${archivo.nombre}"`
            )
            .send(archivo.stream);
    }
}
