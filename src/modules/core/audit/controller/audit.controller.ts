//src/modules/core/audit/controller/audit.controller.ts
//Controlador para manejar las solicitudes relacionadas con la auditoría, como obtener logs de auditoría y registrar auditorías manuales.
import { Controller, Get, Query, Post, Body, UseGuards, Req, UsePipes, Param, ParseUUIDPipe } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { ObtenerAuditQuerySchema } from '@jyp/shared-contracts';
import type { ObtenerAuditQueryDto, AuditLogDto } from '@jyp/shared-contracts';
import { ObtenerLogsUseCase } from '../use-cases/obtenerLogs.useCase';
import { ObtenerHistorialUseCase } from '../use-cases/obtenerHistorial.useCase';
import { RegistroAuditoriaUseCase } from '../use-cases/registroAuditoria.useCase';
import type { FastifyRequest } from 'fastify';
import { ApiSwaggerAuditoriaController, ApiSwaggerCrearAuditoria, ApiSwaggerListarAuditoria, ApiSwaggerObtenerAuditoriaPorId } from '../decorators/audit-swagger.decorator';

/**
 * Controlador para manejar las solicitudes relacionadas con la auditoría.
 * Proporciona endpoints para obtener logs de auditoría y registrar auditorías manuales.
 * Requiere autenticación mediante JWT y autorización basada en roles.
 * Los roles permitidos son: ADMIN, CONTADOR, ASISTENTE, RRHH.
 * @Uri /api/audit
 * @roles ADMIN, CONTADOR, ASISTENTE, RRHH
 */
@ApiSwaggerAuditoriaController()
@Controller('api/v1/core/audit')
@UseGuards(JwtAccessGuard, RolesGuard)
export class AuditController {
  constructor(
    private readonly obtenerLogsUseCase: ObtenerLogsUseCase,
    private readonly registroAuditoriaUseCase: RegistroAuditoriaUseCase,
    private readonly obtenerHistorialUseCase: ObtenerHistorialUseCase,
  ) {}

  /**
   * Obtiene los logs de auditoría con filtros y paginación.
   * Requiere que el usuario tenga el rol de 'ADMIN', 'CONTADOR'.
   * @summary Listar logs de auditoría
   * GET /api/v1/core/audit/logs
   * @param query: Parámetros de consulta para filtrar los logs de auditoría.
   * @query page: Número de página (opcional, por defecto 1).
   * @query limit: Número de registros por página (opcional, por defecto 50, máximo 100).
   * @query tabla_afectada: Filtrar por tabla afectada (opcional).
   * @query accion: Filtrar por acción (opcional).
   * @query usuario_id: Filtrar por ID de usuario (opcional).
   * @query registro_id: Filtrar por ID de registro (opcional).
   * @returns: Un objeto con los logs de auditoría y la información de paginación.
   */
  @ApiSwaggerListarAuditoria()
  @Get('logs')
  @Roles('ADMIN', 'RRHH', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(ObtenerAuditQuerySchema))
  async obtenerLogs(
    @Query() queryParams: ObtenerAuditQueryDto,
    @Req() req: FastifyRequest & { user: { id: string; rol: string } },
  ) {
    return await this.obtenerLogsUseCase.execute(queryParams, req.user);
  }

  /**
   * Registra un log de auditoría manual.
   * Requiere que el usuario tenga el rol de 'ADMIN', 'CONTADOR' o 'ASISTENTE' o 'RRHH'.
   * POST /api/v1/core/audit/logs
   * @param payload: Objeto que contiene la información del log de auditoría a registrar.
   * @dto : AuditLogDto : {
   *    - id: string (UUID) - Identificador único del log de auditoría (opcional).
   *    - usuario_id: string (UUID) - Identificador del usuario que realiza la acción (opcional).
   *    - accion: string - Acción realizada (obligatorio).
   *    - tabla_afectada: string - Nombre de la tabla afectada (obligatorio). 
   *    - registro_id: string (UUID) - Identificador del registro afectado (obligatorio).
   *    - valores_antes: Record<string, unknown> (opcional) - Valores antes de la acción.
   *    - valores_despues: Record<string, unknown> (opcional) - Valores después de la acción.
   *    - direccion_ip: string (IP) - Dirección IP del usuario que realiza la acción (opcional).
   *  }
   * @body: AuditLogDto - Objeto que contiene la información del log de auditoría a registrar.
   * }
   * @returns: El log de auditoría registrado.
   */
  @ApiSwaggerCrearAuditoria()
  @Post('logs')
  @Roles('ADMIN', 'CONTADOR', 'ASISTENTE', 'RRHH')
  @UsePipes(new ZodValidationPipe(ObtenerAuditQuerySchema))
  async registrarAuditoria(@Body() payload: AuditLogDto) {
    return await this.registroAuditoriaUseCase.execute(payload);
  }

  /**
   * Obtiene un log de auditoría por su ID.
   * Requiere que el usuario tenga el rol de 'ADMIN' o 'CONTADOR'.
   * @summary Obtener log de auditoría por ID
   * @GET /api/v1/core/audit/logs/:id
   * @param id - El ID del log de auditoría a obtener.
   * @param req - La solicitud HTTP.
   * @returns El log de auditoría correspondiente al ID proporcionado.
   */
  @Get('logs/:id')
  @Roles('ADMIN', 'RRHH', 'CONTADOR')
  @ApiSwaggerObtenerAuditoriaPorId()
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string, @Req() req: FastifyRequest & { user: { id: string; rol: string } }) {
    return this.obtenerLogsUseCase.obtenerPorId(id, req.user);
  }

  /**
   * Obtiene el historial de auditoría de un registro específico.
   * Requiere que el usuario tenga el rol de 'ADMIN', 'RRHH' o 'CONTADOR'.
   * @summary Obtener historial de auditoría de un registro
   * @description Obtiene el historial de auditoría de un registro específico, incluyendo los cambios realizados en sus campos.
   * @GET /api/v1/core/audit/historial/:tabla/:registroId
   * @param tabla - Nombre de la tabla afectada.
   * @param registroId - ID del registro afectado.
   * @param req - La solicitud HTTP.
   * @param page - Número de página para la paginación (opcional, por defecto 1).
   * @param limit - Cantidad de registros por página para la paginación (opcional, por defecto 20).
   * @returns Un objeto con el historial de auditoría del registro, incluyendo los cambios realizados en sus campos.
   */
  @Get('historial/:tabla/:registroId')
  @Roles('ADMIN', 'RRHH', 'CONTADOR')
  async obtenerHistorialRegistro(@Param('tabla') tabla: string, @Param('registroId', ParseUUIDPipe) registroId: string,
    @Req() req: FastifyRequest & { user: { id: string; rol: string } }, @Query('page') page = '1', @Query('limit') limit = '20',
  ) {
    return this.obtenerHistorialUseCase.obtenerHistorialRegistro(
      tabla,
      registroId,
      req.user,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
    );
  }
}
