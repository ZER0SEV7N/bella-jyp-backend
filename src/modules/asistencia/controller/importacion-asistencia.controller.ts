import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { BadRequestException, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiSwaggerImportacionAsistenciaController, ApiSwaggerImportarMarcacionesExcel, ApiSwaggerPlantillaMarcaciones, ApiSwaggerValidarMarcacionesExcel } from '../decorator/importacion-asistencia-swagger.decorator';
import { DescargarPlantillaMarcacionesUseCase } from '../use-cases/asistencias/descargarPlantillaMarcaciones.useCase';
import { ImportarMarcacionesUseCase } from '../use-cases/asistencias/importarMarcaciones.useCase';
import { ValidarImportacionMarcacionesUseCase } from '../use-cases/asistencias/validarImportacionMarcaciones.useCase';

import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';

@ApiSwaggerImportacionAsistenciaController()
@Controller('api/asistencia/importacion')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'RRHH', 'ASISTENTE')
export class ImportacionAsistenciaController {
    constructor(private readonly descargarPlantillaMarcaciones: DescargarPlantillaMarcacionesUseCase, private readonly validarImportacionMarcaciones: ValidarImportacionMarcacionesUseCase, private readonly importarMarcaciones: ImportarMarcacionesUseCase) {}

    @Get('plantilla')
    @ApiSwaggerPlantillaMarcaciones()
    async plantilla(@Res() reply: FastifyReply) {
        reply.header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        reply.header('content-disposition', 'attachment; filename="marcaciones_biometrico.xlsx"');
        return reply.send(await this.descargarPlantillaMarcaciones.execute());
    }

    @Post('validar-excel')
    @ApiSwaggerValidarMarcacionesExcel()
    async validar(@Req() req: SolicitudAutenticada) {
        return this.procesar(req, false);
    }

    @Post('importar-excel')
    @ApiSwaggerImportarMarcacionesExcel()
    async importar(@Req() req: SolicitudAutenticada) {
        return this.procesar(req, true);
    }

    private async procesar(req: SolicitudAutenticada, confirmar: boolean) {
        const archivo = await req.file({ limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
        if (!archivo) throw new BadRequestException('Adjunte un archivo XLSX en el campo archivo.');
        return confirmar ? this.importarMarcaciones.execute(archivo, actorSolicitud(req)) : this.validarImportacionMarcaciones.execute(archivo);
    }
}
