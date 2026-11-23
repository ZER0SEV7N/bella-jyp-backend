//src/modules/RRHH/dashboard/decorators/dashboard-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiErroresOperacion,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import { DashboardRrhhResponseSchema } from '@jyp/shared-contracts';

const ROLES_DASHBOARD = ['ADMIN', 'RRHH'];

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para el dashboard de RRHH.
 */
export function ApiSwaggerDashboardController() {
  return applyDecorators(
    ApiTags('RRHH - Dashboard'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `GET /api/v1/rrhh/dashboard`.
 */
export function ApiSwaggerObtenerDashboard() {
  return applyDecorators(
    ApiQuery({
      name: 'periodo',
      required: false,
      description:
        'Período a consultar en formato `YYYY-MM` (en hora de Lima). Si se omite, toma el mes en curso.',
      schema: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}$',
        example: '2026-11',
      },
    }),
    ApiOperacionDocumentada({
      summary: 'Obtener dashboard ejecutivo de RRHH',
      description:
        'Devuelve dotación hasta la fecha de corte (activos, altas, ceses, rotación y comparación con el mes anterior en base a `empleados`), asistencia de la semana lunes-viernes desde `incidencias_mes` excluyendo descansos y días `NO_EVALUADO`, estado del cierre mensual, cumpleaños del mes, alertas de contratos por vencer en 30 días de empleados activos en `fecha_corte` (solo `VIGENTE` en el mes actual; cualquier estado distinto de `ANULADO` en meses pasados) y solicitudes en trámite (`PENDIENTE` o `EN_REVISION`). Rechaza períodos futuros con 422.',
      roles: ROLES_DASHBOARD,
      status: 200,
      respuesta: esquemaContrato(DashboardRrhhResponseSchema),
    }),
    ApiResponse({
      status: 422,
      description: 'No se puede consultar un mes futuro (`periodo`).',
    })
  );
}
