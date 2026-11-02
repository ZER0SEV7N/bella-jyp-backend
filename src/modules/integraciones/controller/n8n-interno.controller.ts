//src/modules/integraciones/controller/n8n-interno.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ReclamarTrabajoSchema, ResultadoIntegracionSchema, SobreN8nSchema, type SobreN8nDto, type ReclamarTrabajoDto, type ResultadoIntegracionDto} from '@jyp/shared-contracts';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { FirmaN8NGuard } from '@/common/guards/firma-n8n.guard';
import { AtenderTrabajoN8nUseCase } from '../use-cases/atenderTrabajoN8N.useCase';
import { DatosExportacionService } from '../services/datos-exportacion.service';

/**
 * Controlador para manejar las solicitudes internas de N8N relacionadas con la atención de trabajos de integración.
 * Este controlador expone endpoints para validar la existencia de trabajos, reclamar trabajos para su procesamiento,
 * obtener datos de exportación y finalizar trabajos con el resultado obtenido. También aplica validaciones de seguridad
 * mediante la firma de N8N para garantizar la autenticidad de las solicitudes.
 * CANAL M2M: Este controlador es utilizado por el servicio externo de N8N para interactuar con la aplicación y procesar los trabajos de integración.
 * Los endpoints utilizados por N8N son:
 * - POST /api/v1/integraciones/n8n/validar: Valida la existencia de un trabajo de integración por su ID.
 * - POST /api/v1/integraciones/n8n/trabajos/:id/reclamar: Reclama un trabajo de integración para su procesamiento.
 * - GET /api/v1/integraciones/n8n/trabajos/:id/datos: Obtiene los datos de exportación de un trabajo de integración por su ID y página.
 * - POST /api/v1/integraciones/n8n/trabajos/:id/resultado: Finaliza un trabajo de integración con el resultado obtenido.
 * 
 */
@Controller('api/v1/integraciones/n8n')
@UseGuards(FirmaN8NGuard)
export class N8nInternoController {
    constructor(
        private readonly atender: AtenderTrabajoN8nUseCase,
        private readonly datos: DatosExportacionService
    ) {}

    /**
     * Endpoint para validar la existencia de un trabajo de integración por su ID.
     * Este endpoint es utilizado por el servicio externo de N8N para verificar si un trabajo de integración existe antes de procesarlo.
     * @Post /api/v1/integraciones/n8n/validar
     * @Body - Valida el DTO de solicitud de validación mediante un ZodValidationPipe.
     * @param dto : {
     *   - trabajo_id: string // ID del trabajo de integración a validar.
     * }
     * @returns - Un objeto que contiene el ID del trabajo de integración si existe.
     * @throws NotFoundException - Si el trabajo no existe.
     */
    @Post('validar')
    validar(@Body(new ZodValidationPipe(SobreN8nSchema)) dto: SobreN8nDto) {
        return this.atender.validar(dto.trabajo_id);
    }

    /**
     * Endpoint para reclamar un trabajo de integración.
     * Este endpoint es utilizado por el servicio externo de N8N para reclamar un trabajo de integración y marcarlo como "PROCESANDO".
     * @Post /api/v1/integraciones/n8n/trabajos/:id/reclamar
     * @param id - El ID del trabajo de integración a reclamar, validado como UUID mediante ParseUUIDPipe.
     * @body - Valida el DTO de solicitud de reclamación mediante un ZodValidationPipe.
     * @param dto : ReclamarTrabajoDto : {
     *   - ejecucion_id: string // ID de la ejecución del trabajo de integración.
     * }
     * @returns - Un objeto que contiene el ID del trabajo, su tipo, periodo, total de planillas y la solicitud descifrada.
     */
    @Post('trabajos/:id/reclamar')
    reclamar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ReclamarTrabajoSchema))dto: ReclamarTrabajoDto) {
        return this.atender.reclamar(id, dto.ejecucion_id);
    }

    /**
     * Endpoint para obtener los datos de exportación de un trabajo de integración por su ID y página.
     * Este endpoint es utilizado por el servicio externo de N8N para obtener los datos de exportación de un trabajo de integración en formato paginado.
     * @Get /api/v1/integraciones/n8n/trabajos/:id/datos
     * @param id - El ID del trabajo de integración a consultar, validado como UUID mediante ParseUUIDPipe.
     * @param pagina - El número de página de los datos de exportación a obtener, validado como entero mediante ParseIntPipe.
     * @param ejecucionId - El ID de ejecución del trabajo de integración, validado como UUID mediante ParseUUIDPipe.
     * @returns - Un objeto que contiene los datos de exportación de la página solicitada.
     */
    @Get('trabajos/:id/datos')
    datosPagina( @Param('id', ParseUUIDPipe) id: string, @Query('pagina', ParseIntPipe) pagina: number, @Query('ejecucion_id', ParseUUIDPipe) ejecucionId: string) {
        return this.datos.pagina(id, pagina, ejecucionId);
    }

    /**
     * Endpoint para finalizar un trabajo de integración con el resultado obtenido.
     * Este endpoint es utilizado por el servicio externo de N8N para finalizar un trabajo de integración y registrar el resultado obtenido.
     * @Post /api/v1/integraciones/n8n/trabajos/:id/resultado
     * @param id - El ID del trabajo de integración a finalizar, validado como UUID mediante ParseUUIDPipe.
     * @param ejecucionId - El ID de ejecución del trabajo de integración, validado como UUID mediante ParseUUIDPipe.
     * @Body - Valida el DTO de resultado de integración mediante un ZodValidationPipe.
     * @param dto ResultadoIntegracionDto : {
     *   - exito: boolean // Indica si el trabajo de integración se completó con éxito.
     *   - mensaje?: string // Mensaje adicional sobre el resultado del trabajo de integración.
     *   - error?: string // Detalles del error si el trabajo de integración falló.
     * }
     * @returns - Un objeto que contiene el ID del trabajo de integración finalizado y su estado final.
     */
    @Post('trabajos/:id/resultado')
    finalizar( @Param('id', ParseUUIDPipe) id: string, @Query('ejecucion_id', ParseUUIDPipe) ejecucionId: string, @Body(new ZodValidationPipe(ResultadoIntegracionSchema)) dto: ResultadoIntegracionDto ) {
        return this.atender.finalizar(id, ejecucionId, dto);
    }
}
