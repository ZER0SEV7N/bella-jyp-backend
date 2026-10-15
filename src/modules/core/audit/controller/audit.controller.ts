//src/modules/core/audit/controller/audit.controller.ts
//Controlador para manejar las solicitudes relacionadas con la auditoría, como obtener logs de auditoría y registrar auditorías manuales.
import { Controller, Get, Query, Post, Body, UseGuards, Req, UsePipes } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { ObtenerAuditQuerySchema } from '@jyp/shared-contracts';
import type { ObtenerAuditQueryDto, AuditLogDto } from '@jyp/shared-contracts';
import { ObtenerLogsUseCase } from '../use-cases/obtenerLogs.useCase';
import { RegistroAuditoriaUseCase } from '../use-cases/registroAuditoria.useCase';
import type { FastifyRequest } from 'fastify';
import { ApiSwaggerAuditoriaController, ApiSwaggerCrearAuditoria, ApiSwaggerListarAuditoria } from '../decorators/audit-swagger.decorator';

/**
 * Controlador para manejar las solicitudes relacionadas con la auditoría.
 * Proporciona endpoints para obtener logs de auditoría y registrar auditorías manuales.
 * Requiere autenticación mediante JWT y autorización basada en roles.
 * Los roles permitidos son: ADMIN, CONTADOR, ASISTENTE, RRHH.
 * @Uri /api/audit
 * @roles ADMIN, CONTADOR, ASISTENTE, RRHH
 */
@ApiSwaggerAuditoriaController()
@Controller('api/v1/audit')
@UseGuards(JwtAccessGuard, RolesGuard)
export class AuditController {
  constructor(
    private readonly obtenerLogsUseCase: ObtenerLogsUseCase,
    private readonly registroAuditoriaUseCase: RegistroAuditoriaUseCase,
  ) {}

  /**
   * Obtiene los logs de auditoría con filtros y paginación.
   * Requiere que el usuario tenga el rol de 'ADMIN', 'CONTADOR'.
   * GET /api/audit/logs
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
  //@Roles('ADMIN', 'CONTADOR')
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
   * POST /api/audit/logs
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
}
