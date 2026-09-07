//src/modules/asistencia/controller/incidencias.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, UsePipes, HttpStatus } from "@nestjs/common";
import { JwtAccessGuard } from "@/common/guards/jwt-access.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe";
import { GenerarIncidenciasPeriodoSchema } from "@jyp/shared-contracts";
import type { GenerarIncidenciasPeriodoDto } from "@jyp/shared-contracts";
import { GenerarIncidenciasMesUseCase } from "../use-cases/generarIncidenciasMes.useCase";
import { ApiSwaggerIncidenciasController, ApiSwaggerGenerarCierre } from "../decorator/incidencias-swagger.decorator";

/**
 * Controlador para la gestión de incidencias de asistencia.
 * Este controlador expone endpoints para generar incidencias de asistencia
 * para un período específico, procesando los registros de los empleados activos.
 * Se asegura de que solo usuarios autenticados y con los roles adecuados puedan acceder a estos endpoints.
 */
@Controller('api/asistencia/incidencias')
@UseGuards(JwtAccessGuard, RolesGuard)
@ApiSwaggerIncidenciasController()
export class IncidenciasController {
    constructor(private readonly generarIncidenciasMesUseCase: GenerarIncidenciasMesUseCase) {}
 
    /**
     * Endpoint para generar el cierre de incidencias de asistencia para un período específico.
     * @Post /api/asistencia/incidencias/generar-cierre
     * @HttpCode 200 - OK
     * @Roles ADMIN, RRHH, CONTADOR - Solo usuarios con estos roles pueden acceder a este endpoint.
     * @param dto {
     *  - periodo: string - El período para el cual se generarán las incidencias (formato YYYY-MM).
     *  - area_id?: string - (Opcional) ID del área para filtrar los empleados.
     *  - empleado_id?: string - (Opcional) ID del empleado para filtrar el procesamiento.
     * };
     * @returns Un objeto con el resumen del procesamiento, incluyendo el número de empleados procesados y los detalles de cada uno.
     * @throws BadRequestException - Si el DTO es inválido.
     * @throws NotFoundException - Si no se encuentran empleados activos para procesar.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante el procesamiento.
     */
    @Post('generar-cierre')
    @HttpCode(HttpStatus.OK)
    @Roles('ADMIN', 'RRHH', 'CONTADOR')
    @ApiSwaggerGenerarCierre()
    @UsePipes(new ZodValidationPipe(GenerarIncidenciasPeriodoSchema))
    async generarCierre(@Body() dto: GenerarIncidenciasPeriodoDto) {
        return await this.generarIncidenciasMesUseCase.execute(dto);
    }
}