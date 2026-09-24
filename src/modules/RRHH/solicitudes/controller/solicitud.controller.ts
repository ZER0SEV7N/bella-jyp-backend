//src/modules/RRHH/solicitudes/controller/solicitud.controller.ts
import { Controller, Post, Get, Patch, Body, Param, UseGuards, UsePipes, Req, HttpCode, HttpStatus, ParseUUIDPipe, BadRequestException, } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';
import { CrearSolicitudSchema, EvaluarSolicitudSchema } from '@jyp/shared-contracts';
import type { CrearSolicitudDto, EvaluarSolicitudDto, } from '@jyp/shared-contracts';
//Casos de uso
import { CrearSolicitudUseCase } from '../use-cases/crearSolicitud.useCase';
import { ObtenerDetalleSolicitudUseCase } from '../use-cases/obtenerDetalleSolicitud.useCase';
import { AsignarRevisionDeSolicitudUseCase } from '../use-cases/asignarRevisionDeSolicitud.useCase';
import { EvaluarSolicitudUseCase } from '../use-cases/evaluarSolicitud.useCase';
import { AnularSolicitudUseCase } from '../use-cases/anularSolicitud.useCase';
//Decoradores Swagger
import { ApiSwaggerSolicitudController, ApiSwaggerCrearSolicitud, ApiSwaggerObtenerDetalleSolicitud, ApiSwaggerAsignarRevision, ApiSwaggerEvaluarSolicitud, ApiSwaggerAnularSolicitud } from '../decorator/solicitudes-swagger.decorator';

/**
 * Controlador para la gestión de solicitudes de permisos, vacaciones y descansos médicos.
 * Este controlador expone endpoints para crear, obtener detalles, asignar revisiones, evaluar y anular solicitudes.
 * Se asegura de que solo usuarios autenticados y con los roles adecuados puedan acceder a estos endpoints.
 */
@Controller('api/rrhh/solicitudes')
@UseGuards(JwtAccessGuard, RolesGuard)
@ApiSwaggerSolicitudController()
export class SolicitudController {
    constructor(
        private readonly crearSolicitudUseCase: CrearSolicitudUseCase,
        private readonly obtenerDetalleUseCase: ObtenerDetalleSolicitudUseCase,
        private readonly asignarRevisionUseCase: AsignarRevisionDeSolicitudUseCase,
        private readonly evaluarSolicitudUseCase: EvaluarSolicitudUseCase,
        private readonly anularSolicitudUseCase: AnularSolicitudUseCase,
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
    @ApiSwaggerCrearSolicitud()
    @Roles('ADMIN', 'RRHH', 'EMPLEADO')
    @UsePipes(new ZodValidationPipe(CrearSolicitudSchema))
    async crear(@Req() req: FastifyRequest, @Body() body: any) {
        //Manejo de solicitud multipart para archivos adjuntos (PDF / Word)
        let rawData = body;
        let archivoData: { url: string; nombreOriginal: string } | undefined;

        // Procesamiento Multipart nativo de Fastify
        if (req.isMultipart()) {
            const filePart = await req.file();

            if (filePart) {
                // Almacenar archivo usando la utilidad existente (PDF / Word)
                const rutaRelativa = await FileStorageUtil.guardarArchivoMultipart(filePart, 'sustentos');
                archivoData = {
                    url: rutaRelativa,
                    nombreOriginal: filePart.filename
                };

                //Extraer los campos de texto enviados en el formulario multipart
                const fields: Record<string, any> = {};
                for (const key of Object.keys(filePart.fields || {})) {
                    const field: any = (filePart.fields as any)[key];
                    fields[key] = field?.value !== undefined ? field.value : field;
                }
                rawData = fields;
            }
        }

        //Validación mediante esquema Zod
        const dto: CrearSolicitudDto = CrearSolicitudSchema.parse(rawData);

        //Obtener identidad del empleado solicitante desde el JWT
        const usuarioSesion = (req as any).user;
        const empleadoIdSesion = usuarioSesion?.empleado_id || usuarioSesion?.id;

        return await this.crearSolicitudUseCase.execute(dto, empleadoIdSesion, archivoData);
    }

    /**
     * Método para obtener el detalle de una solicitud específica por su ID o código correlativo.
     * @param idOCodigo - string - El ID o código correlativo de la solicitud a consultar.
     * @returns - Un objeto con los detalles completos de la solicitud, incluyendo estado, fechas, motivo, observaciones y cualquier archivo adjunto asociado.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID o código proporcionado.
     * @throws BadRequestException - Si el parámetro idOCodigo es inválido.
     */
    @ApiSwaggerObtenerDetalleSolicitud()
    @Get(':idOCodigo')
    @Roles('ADMIN', 'RRHH', 'COLABORADOR', 'EMPLEADO', 'CONTADOR')
    async obtenerDetalle(@Param('idOCodigo') idOCodigo: string) {
        return await this.obtenerDetalleUseCase.execute(idOCodigo);
    }

    /**
     * Método para asignar una solicitud a revisión por parte del usuario autenticado (ADMIN o RRHH).
     * @param id - string - El ID de la solicitud a asignar para revisión.
     * @param req - FastifyRequest - La solicitud HTTP entrante, utilizada para obtener la identidad del usuario desde el JWT.
     * @returns - Un objeto con el estado actualizado de la solicitud, indicando que ha sido tomada en revisión por el usuario autenticado.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID proporcionado.
     * @throws BadRequestException - Si la solicitud ya fue dictaminada o ya está tomada por otro revisor.
     */
    @ApiSwaggerAsignarRevision()
    @Patch(':id/asignar-revision')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN', 'RRHH')
    async asignarRevision(@Param('id', ParseUUIDPipe) id: string, @Req() req: FastifyRequest) {
        const usuarioId = (req as any).user?.id || (req as any).user?.sub;
        return await this.asignarRevisionUseCase.execute(id, usuarioId);
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
    @ApiSwaggerEvaluarSolicitud()
    @Patch(':id/evaluar')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN', 'RRHH')
    @UsePipes(new ZodValidationPipe(EvaluarSolicitudSchema))
    async evaluar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EvaluarSolicitudDto,@Req() req: FastifyRequest) {
        const usuarioEvaluadorId = (req as any).user?.id || (req as any).user?.sub;
        return await this.evaluarSolicitudUseCase.execute(id, dto, usuarioEvaluadorId);
    }

    /**
     * Método para anular una solicitud, proporcionando un motivo para la anulación.
     * @param id - string - El ID de la solicitud a anular.
     * @param motivo - string - El motivo por el cual se anula la solicitud.
     * @returns - Un objeto con el estado actualizado de la solicitud, indicando que ha sido anulada.
     * @throws NotFoundException - Si no se encuentra la solicitud con el ID proporcionado.
     * @throws BadRequestException - Si el motivo no es válido o no se proporciona.
     */
    @ApiSwaggerAnularSolicitud()
    @Patch(':id/anular')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN', 'RRHH')
    async anular(@Param('id', ParseUUIDPipe) id: string, @Body('motivo') motivo?: string) {
        if (!motivo || motivo.trim().length < 5) throw new BadRequestException({
            title: 'Motivo de anulación requerido',
            detail: 'Debe ingresar un motivo u observación descriptiva de al menos 5 caracteres para anular la solicitud.',
        });
        
        return await this.anularSolicitudUseCase.execute(id, motivo);
    }
}
