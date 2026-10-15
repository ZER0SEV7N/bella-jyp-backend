//src/modules/asistencia/controller/asistencias.controller.ts
import { Controller, Post, HttpCode, HttpStatus, UsePipes, Body, UseGuards, Query, Get } from '@nestjs/common';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { ListarMarcacionesQuerySchema, marcarAsistenciaSchema } from '@jyp/shared-contracts';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import type { ListarMarcacionesQueryDto, MarcarAsistenciaDto } from '@jyp/shared-contracts';
import { CrearMarcacionManualUseCase } from '../use-cases/asistencias/crearMarcacionManual.useCase';
import { ListarMarcacionesUseCase } from '../use-cases/asistencias/listarMarcaciones.useCase';

/**
 * Controlador para la gestión de marcaciones de asistencia.
 * Este controlador expone endpoints para crear marcaciones manuales y listar las marcaciones existentes.
 * Se asegura de que solo usuarios autenticados y con los roles adecuados puedan acceder a estos endpoints.
 * @Url /api/asistencia/marcacion
 */
@Controller('api/asistencia/marcacion')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE')
export class AsistenciaController{
    constructor(private readonly crearMarcacionManualUseCase: CrearMarcacionManualUseCase,
                private readonly listarMarcacionesUseCase: ListarMarcacionesUseCase
    ) {}

    /**
     * Endpoint para crear una marcación manual de asistencia.
     * @Post /api/asistencia/marcacion/web
     * @HttpCode 200 - OK
     * @Roles ADMIN, RRHH, CONTADOR, ASISTENTE - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @UsePipes ZodValidationPipe(marcarAsistenciaSchema) - Valida el DTO de entrada contra el esquema definido.
     * @param dto {
     *  - empleado_id: string - El ID del empleado para quien se creará la marcación.
     *  - fecha: string - La fecha de la marcación (formato YYYY-MM-DD).
     *  - hora: string - La hora de la marcación (formato HH:mm).
     * }
     * @returns Un objeto con el resumen de la operación, incluyendo el ID de la marcación creada.
     * @throws BadRequestException - Si el DTO es inválido.
     * @throws NotFoundException - Si no se encuentra el empleado especificado.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante la creación de la marcación.
     */
    @Post('web')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe( marcarAsistenciaSchema))
    async generarCierre(@Body() dto: MarcarAsistenciaDto) {
        return await this.crearMarcacionManualUseCase.execute(dto);
    }

    /**
     * Endpoint para listar las marcaciones de asistencia según los filtros proporcionados.
     * @Get /api/asistencia/marcacion
     * @HttpCode 200 - OK 
     * @Roles ADMIN, RRHH, CONTADOR, ASISTENTE - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @UsePipes ZodValidationPipe(ListarMarcacionesQuerySchema) - Valida los parámetros de consulta contra el esquema definido.
     * @param query {
     *  - empleado_id?: string - (Opcional) ID del empleado para filtrar las marcaciones.
     *  - fecha_inicio?: string - (Opcional) Fecha de inicio para filtrar las marcaciones (formato YYYY-MM-DD).
     * - fecha_fin?: string - (Opcional) Fecha de fin para filtrar las marcaciones (formato YYYY-MM-DD).
     * }
     * @returns Un objeto con la lista de marcaciones que cumplen con los filtros proporcionados.
     * @throws BadRequestException - Si los parámetros de consulta son inválidos.
     */
    @Get()
    @UsePipes(new ZodValidationPipe(ListarMarcacionesQuerySchema))
    async listarMarcaciones(@Query() query: ListarMarcacionesQueryDto) {
        return await this.listarMarcacionesUseCase.execute(query);
    }
    
}