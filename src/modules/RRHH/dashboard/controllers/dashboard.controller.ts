//src/modules/RRHH/dashboard/controllers/dashboard.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  DashboardRrhhQuerySchema,
  type DashboardRrhhQueryDto,
  type DashboardRrhhResponseDto,
} from '@jyp/shared-contracts';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import {
  ApiSwaggerDashboardController,
  ApiSwaggerObtenerDashboard,
} from '../decorators/dashboard-swagger.decorator';
import { ObtenerDashboardRrhhUseCase } from '../use-cases/obtenerDashboardRrhh.useCase';

/**
 * Controlador del dashboard ejecutivo de RRHH.
 */
@ApiSwaggerDashboardController()
@Controller('api/v1/rrhh/dashboard')
@UseGuards(JwtAccessGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly obtenerDashboardRrhhUseCase: ObtenerDashboardRrhhUseCase
  ) {}

  /**
   * `GET /api/v1/rrhh/dashboard` - Obtiene los indicadores consolidados de RRHH para un período.
   *
   * @param query - Parámetros de consulta con `periodo` opcional (`YYYY-MM`).
   * @returns Resumen consolidado de dotación, asistencia, cierre, cumpleaños, contratos y solicitudes.
   */
  @Get()
  @Roles('ADMIN', 'RRHH')
  @ApiSwaggerObtenerDashboard()
  async obtenerDashboard(
    @Query(new ZodValidationPipe(DashboardRrhhQuerySchema))
    query: DashboardRrhhQueryDto
  ): Promise<DashboardRrhhResponseDto> {
    return await this.obtenerDashboardRrhhUseCase.execute(query);
  }
}
