//src/modules/RRHH/solicitudes/controller/solicitud.controller.ts
import { Controller, Post, Get, Patch, Body, Param, UseGuards, UsePipes, Req, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
//Importación de tipos y servicios necesarios para el controlador
import type { FastifyRequest } from 'fastify';
import type { usuarios } from '@prisma/client';
//Decorators y guards de autenticación y autorización
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
//pipes y validaciones de entrada (schema y DTO)
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { CrearSolicitudSchema, EvaluarSolicitudSchema } from '@jyp/shared-contracts';
import type { CrearSolicitudDto, EvaluarSolicitudDto } from '@jyp/shared-contracts';
//Casos de uso
import { CrearSolicitudUseCase } from '../use-cases/crearSolicitud.useCase';
import { ObtenerDetalleSolicitudUseCase } from '../use-cases/obtenerDetalleSolicitud.useCase';
import { ObtenerHistorialSolicitudUseCase } from '../use-cases/obtenerHistorialSolicitud.useCase';
import { AsignarRevisionDeSolicitudUseCase } from '../use-cases/asignarRevisionDeSolicitud.useCase';
import { EvaluarSolicitudUseCase } from '../use-cases/evaluarSolicitud.useCase';
import { AnularSolicitudUseCase } from '../use-cases/anularSolicitud.useCase';
//Helpers de validación y procesamiento de solicitudes
import { leerMultipartSolicitud, limpiarSustentoSolicitud } from '../helpers/multipartSolicitud.helper';
//Decorators de Swagger para documentación de API
import { ApiSwaggerSolicitudController, ApiSwaggerCrearSolicitud, ApiSwaggerObtenerDetalleSolicitud, ApiSwaggerObtenerHistorialSolicitud, ApiSwaggerAsignarRevision, ApiSwaggerEvaluarSolicitud, ApiSwaggerAnularSolicitud } from '../decorator/solicitudes-swagger.decorator';

//Define un tipo de solicitud que extiende FastifyRequest para incluir información del usuario autenticado.
type SolicitudRequest = FastifyRequest & { user: Pick<usuarios, 'id' | 'rol' | 'empleado_id'> };

/**
 * Controlador para la gestión de solicitudes de permisos, vacaciones y descansos médicos.
 * Este controlador expone endpoints para crear, obtener detalles, asignar revisiones, evaluar y anular solicitudes.
 * Se asegura de que solo usuarios autenticados y con los roles adecuados puedan acceder a estos endpoints.
 */
@Controller('api/v1/rrhh/solicitudes')
@UseGuards(JwtAccessGuard, RolesGuard)
@ApiSwaggerSolicitudController()
export class SolicitudController {
    constructor(
        private readonly crearSolicitudUseCase: CrearSolicitudUseCase,
        private readonly obtenerDetalleUseCase: ObtenerDetalleSolicitudUseCase,
        private readonly asignarRevisionUseCase: AsignarRevisionDeSolicitudUseCase,
        private readonly evaluarSolicitudUseCase: EvaluarSolicitudUseCase,
        private readonly anularSolicitudUseCase: AnularSolicitudUseCase,
        private readonly obtenerHistorialUseCase: ObtenerHistorialSolicitudUseCase
    ) {}

    /**
     * Crea una nueva solicitud de permiso, vacaciones o descanso.
     * Este endpoint soporta tanto solicitudes en formato JSON como multipart/form-data para subir archivos adjuntos (PDF o Word, máximo 5MB).
     * @Post /api/rrhh/solicitudes
     * @HttpCode 201 - Created
     * @Roles ADMIN, RRHH, EMPLEADO - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param req - FastifyRequest - La solicitud HTTP entrante, utilizada para manejar multipart/form-data y obtener la identidad del usuario desde el JWT.
     * @param body - Contiene los datos de la solicitud, incluyendo tipo, fechas, motivo y opcionalmente el ID del empleado.
     * @returns Un objeto con los detalles de la solicitud creada, incluyendo su código correlativo generado automáticamente.
     * @throws BadRequestException - Si el DTO es inválido o si ocurre un error al procesar el archivo adjunto.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante la creación de la solicitud.
     */
    @Post()
    @Roles('ADMIN', 'RRHH', 'EMPLEADO')
    @ApiSwaggerCrearSolicitud()
    async crear(@Req() req: SolicitudRequest, @Body() body: unknown) {
        const entrada = req.isMultipart() ? await leerMultipartSolicitud(req) : { campos: body, archivo: undefined };

        try {
            // Multipart se valida después de consumir todas sus partes. JSON usa el mismo contrato.
            const dto = new ZodValidationPipe(CrearSolicitudSchema).transform(entrada.campos, { type: 'body' }) as CrearSolicitudDto;
            return await this.crearSolicitudUseCase.execute(dto, req.user.empleado_id, entrada.archivo, req.user.rol);
        } catch (error) {
            await limpiarSustentoSolicitud(entrada.archivo?.url);
            throw error;
        }
    }

    /**
     * Obtiene el historial de cambios de una solicitud específica por su ID o código correlativo.
     * Este endpoint devuelve un registro de auditoría detallado que incluye todas las modificaciones realizadas a la solicitud, 
     * como cambios de estado, observaciones y fechas de revisión.
     * @Get /api/rrhh/solicitudes/:idOCodigo/historial
     * @Roles ADMIN, RRHH, EMPLEADO, CONTADOR - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param idOCodigo - string - El ID o código correlativo de la solicitud cuyo historial se desea consultar.
     * @param req - FastifyRequest - La solicitud HTTP entrante, utilizada para obtener la identidad del usuario desde el JWT.
     * @returns - Un array de objetos que representan el historial de cambios de la solicitud, incluyendo detalles como fecha, usuario que realizó el cambio, acción realizada y observaciones.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID o código proporcionado.
     * @throws BadRequestException - Si el parámetro idOCodigo es inválido.
     */
    @Get(':idOCodigo/historial')
    @Roles('ADMIN', 'RRHH', 'EMPLEADO', 'CONTADOR')
    @ApiSwaggerObtenerHistorialSolicitud()
    async obtenerHistorial(@Param('idOCodigo') idOCodigo: string, @Req() req: SolicitudRequest) {
        return this.obtenerHistorialUseCase.execute(idOCodigo, req.user.empleado_id, req.user.rol);
    }

    /**
     * Método para obtener el detalle de una solicitud específica por su ID o código correlativo.
     * @param idOCodigo - string - El ID o código correlativo de la solicitud a consultar.
     * @returns - Un objeto con los detalles completos de la solicitud, incluyendo estado, fechas, motivo, observaciones y cualquier archivo adjunto asociado.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID o código proporcionado.
     * @throws BadRequestException - Si el parámetro idOCodigo es inválido.
     */
    @Get(':idOCodigo')
    @Roles('ADMIN', 'RRHH', 'EMPLEADO', 'CONTADOR')
    @ApiSwaggerObtenerDetalleSolicitud()
    async obtenerDetalle(@Param('idOCodigo') idOCodigo: string, @Req() req: SolicitudRequest) {
        return this.obtenerDetalleUseCase.execute(idOCodigo, req.user.empleado_id, req.user.rol);
    }

    /**
     * Método para asignar una solicitud a revisión por parte del usuario autenticado (ADMIN o RRHH).
     * @param id - string - El ID de la solicitud a asignar para revisión.
     * @param req - FastifyRequest - La solicitud HTTP entrante, utilizada para obtener la identidad del usuario desde el JWT.
     * @returns - Un objeto con el estado actualizado de la solicitud, indicando que ha sido tomada en revisión por el usuario autenticado.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID proporcionado.
     * @throws BadRequestException - Si la solicitud ya fue dictaminada o ya está tomada por otro revisor.
     */
    @Patch(':id/asignar-revision')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN', 'RRHH')
    @ApiSwaggerAsignarRevision()
    async asignarRevision(@Param('id', ParseUUIDPipe) id: string, @Req() req: SolicitudRequest) {
        return this.asignarRevisionUseCase.execute(id, req.user.id);
    }

    /**
     * Método para evaluar una solicitud en revisión, permitiendo aprobar o rechazar la misma.
     * @param id - string - El ID de la solicitud a evaluar.
     * @param dto {
     *    - estado: 'APROBADO' | 'RECHAZADO' - El nuevo estado de la solicitud.
     *    - observacion?: string - (Opcional) Observación o comentario del evaluador.
     *    - fecha_evaluacion?: string - (Opcional) Fecha de evaluación en formato ISO 8601. Si no se proporciona, se usará la fecha actual.
     *  }
     * @Roles ADMIN, RRHH - Solo usuarios con estos roles pueden evaluar solicitudes.
     * @param req - FastifyRequest - La solicitud HTTP entrante, utilizada para obtener la identidad del evaluador desde el JWT.
     * @returns - Un objeto con el estado actualizado de la solicitud, incluyendo el resultado de la evaluación y cualquier observación registrada.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID proporcionado.
     * @throws BadRequestException - Si el DTO es inválido o si la solicitud no está en estado EN_REVISION.
     */
    @Patch(':id/evaluar')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN', 'RRHH')
    @UsePipes(new ZodValidationPipe(EvaluarSolicitudSchema))
    @ApiSwaggerEvaluarSolicitud()
    async evaluar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EvaluarSolicitudDto, @Req() req: SolicitudRequest) {
        return this.evaluarSolicitudUseCase.execute(id, dto, req.user.id);
    }

    /**
     * Método para anular una solicitud, proporcionando un motivo para la anulación.
     * @param id - string - El ID de la solicitud a anular.
     * @param motivo - string - El motivo por el cual se anula la solicitud.
     * @returns - Un objeto con el estado actualizado de la solicitud, indicando que ha sido anulada.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID proporcionado.
     * @throws BadRequestException - Si el motivo no es válido o no se proporciona.
     */
    @Patch(':id/anular')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN', 'RRHH')
    @ApiSwaggerAnularSolicitud()
    async anular(@Param('id', ParseUUIDPipe) id: string, @Body('motivo') motivo: string) {
        return this.anularSolicitudUseCase.execute(id, motivo);
    }
}
