//src/modules/asistencia/decorator/incidencias.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiExtension } from '@nestjs/swagger';

/**
 * Decorador para aplicar configuraciones comunes a los endpoints del controlador de incidencias.
 * Incluye etiquetas de Swagger, autenticación y roles requeridos.
 */
export function ApiSwaggerIncidenciasController() {
  return applyDecorators(
    ApiTags('Módulo Asistencia - Cierre e Incidencias Mensuales'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH', 'CONTADOR'])
  );
}

export function ApiSwaggerGenerarCierre() {
  return applyDecorators(
    ApiOperation({
      summary: 'CU-17: Cierre y Consolidación Mensual de Asistencia',
      description: "Procesa las marcaciones del mes contra los horarios programados y solicitudes aprobadas. " +
      "Computa días trabajados (base 30 comercial peruana), faltas injustificadas y minutos de tardanza, persistiendo el resultado en la tabla incidencias_mes para el cálculo de nómina (CU-20)."
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['periodo'],
        properties: {
          periodo: {
            type: 'string',
            example: '2026-09',
            description: 'Periodo fiscal a consolidar en formato YYYY-MM.'
          },
          area_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            example: '018f4a7c-7777-7000-1111-000000000001',
            description: 'UUID opcional para procesar únicamente a colaboradores de un área.'
          },
          empleado_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            example: '018f4a7c-8888-7000-2222-000000000001',
            description: 'UUID opcional para reprocesar a un colaborador individual.'
          }
        }
      }
    }),
    ApiResponse({
      status: 200,
      description: 'Incidencias consolidadas y persistidas exitosamente.',
      schema: {
        example: {
          mensaje: 'Se procesaron exitosamente las incidencias para 12 colaborador(es) en el periodo 2026-09.',
          periodo: '2026-09',
          total_procesados: 12,
          detalle: [{
            empleado_id: '018f4a7c-8888-7000-2222-000000000001',
            nombre_completo: 'Carlos Mendoza',
            nro_documento: '72345678',
            periodo: '2026-09',
            dias_computables: 30,
            faltas: 0,
            minutos_tardanza: 1
          }]
        }
      }
    }),
    ApiResponse({
      status: 400,
      description: 'Formato de periodo inválido (debe ser YYYY-MM).'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token ausente o inválido.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Privilegios insuficientes (requiere ADMIN, RRHH o CONTADOR).'
    }),
    ApiResponse({
      status: 404,
      description: 'No se encontraron colaboradores activos con los criterios especificados.'
    })
  );
}