//src/modules/asistencia/controller/importacion-asistencia.controller.ts
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { BadRequestException, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSwaggerImportacionAsistenciaController, ApiSwaggerImportarMarcacionesExcel, ApiSwaggerValidarMarcacionesExcel } from '../decorator/importacion-asistencia-swagger.decorator';
import { ImportarMarcacionesUseCase } from '../use-cases/asistencias/importarMarcaciones.useCase';
import { ValidarImportacionMarcacionesUseCase } from '../use-cases/asistencias/validarImportacionMarcaciones.useCase';
import type { SolicitudAutenticada } from '@/common/utils/actor-operacion.util';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';

/**
 * Controlador para la importación de marcaciones de asistencia desde archivos Excel.
 * Este controlador expone endpoints para validar e importar marcaciones de asistencia desde archivos Excel.
 * Se asegura de que solo usuarios autenticados y con los roles adecuados puedan acceder a estos endpoints.
 * Las URIS implementadas son:
 * - POST /api/v1/asistencia/importacion/validar-excel: Permite validar un archivo Excel de marcaciones de asistencia.
 * - POST /api/v1/asistencia/importacion/importar-excel: Permite importar un archivo Excel de marcaciones de asistencia.
 */
@ApiSwaggerImportacionAsistenciaController()
@Controller('api/v1/asistencia/importacion')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'RRHH', 'ASISTENTE')
export class ImportacionAsistenciaController {
    constructor(private readonly validarImportacionMarcaciones: ValidarImportacionMarcacionesUseCase, 
        private readonly importarMarcaciones: ImportarMarcacionesUseCase) {}


    /**
     * Endpoint para validar un archivo Excel de marcaciones de asistencia.
     * @Post /api/v1/asistencia/importacion/validar-excel
     * @Roles ADMIN, RRHH, ASISTENTE - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param req - La solicitud autenticada que contiene el archivo Excel y la información del usuario que realiza la operación.
     * @returns - Una promesa que se resuelve con el resultado de la validación de las marcaciones.
     * @throws - BadRequestException si no se adjunta un archivo Excel en la solicitud.
     */
    @Post('validar-excel')
    @ApiSwaggerValidarMarcacionesExcel()
    async validar(@Req() req: SolicitudAutenticada) {
        return this.procesar(req, false);
    }

    /**
     * Endpoint para importar un archivo Excel de marcaciones de asistencia.
     * @Post /api/v1/asistencia/importacion/importar-excel
     * @Roles ADMIN, RRHH, ASISTENTE - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param req - La solicitud autenticada que contiene el archivo Excel y la información del usuario que realiza la operación.
     * @returns - Una promesa que se resuelve con el resultado de la importación de las marcaciones.
     * @throws - BadRequestException si no se adjunta un archivo Excel en la solicitud.
     */
    @Post('importar-excel')
    @ApiSwaggerImportarMarcacionesExcel()
    async importar(@Req() req: SolicitudAutenticada) {
        return this.procesar(req, true);
    }

    /**
     * Procesa la solicitud de importación o validación de marcaciones de asistencia desde un archivo Excel.
     * Dependiendo del valor del parámetro 'confirmar', se ejecuta la validación o la importación de las marcaciones.
     * @param req - La solicitud autenticada que contiene el archivo Excel y la información del usuario que realiza la operación.
     * @param confirmar - Un booleano que indica si se debe confirmar la importación de las marcaciones (true) o solo validar el archivo (false).
     * @returns - Una promesa que se resuelve con el resultado de la validación o importación de las marcaciones.
     * @throws - BadRequestException si no se adjunta un archivo Excel en la solicitud.
     */
    private async procesar(req: SolicitudAutenticada, confirmar: boolean) {
        const archivo = await req.file({ limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
        if (!archivo) 
            throw new BadRequestException('Adjunte un archivo XLSX en el campo archivo.');
        return confirmar ? this.importarMarcaciones.execute(archivo, actorSolicitud(req)) : this.validarImportacionMarcaciones.execute(archivo);
    }
}
