//src/modules/asistencia/decorator/incidencias.decorator.ts
import { ApiContratoBody, ApiContratoQuery, ApiErroresOperacion, ApiOperacionDocumentada } from '@/common/decorators/api-contrato.decorator';
import { AprobarIncidenciasSchema, GenerarIncidenciasPeriodoSchema, ListarIncidenciasQuerySchema } from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { respuestaIncidencia } from './asistencia-respuestas.swagger';

/**
 * Decorador para aplicar configuraciones comunes a los endpoints del controlador de incidencias.
 * Incluye etiquetas de Swagger, autenticación y roles requeridos.
 */
export function ApiSwaggerIncidenciasController() {
    return applyDecorators(ApiTags('Módulo Asistencia - Cierre e Incidencias Mensuales'), ApiBearerAuth('JWT-auth'), ApiErroresOperacion());
}
export function ApiSwaggerGenerarCierre() {
    return applyDecorators(
        ApiContratoBody(GenerarIncidenciasPeriodoSchema),
        ApiOperacionDocumentada({
            summary: 'Generar resumen mensual de asistencia',
            description:
                'Procesa un lote por período, área o colaborador. Detecta pendientes y devuelve siguiente_cursor cuando hay otra página. Generar el resumen no lo aprueba.',
            roles: ['ADMIN', 'RRHH', 'CONTADOR'],
            respuesta: {
                type: 'object',
                properties: {
                    periodo: { type: 'string' },
                    total_procesados: { type: 'integer' },
                    errores: { type: 'integer' },
                    siguiente_cursor: { type: 'string', nullable: true },
                    detalle: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { empleado_id: { type: 'string' }, id: { type: 'string' }, estado: { type: 'string' }, error: { type: 'string' } }
                        }
                    }
                }
            }
        })
    );
}
export function ApiSwaggerAprobarIncidencias() {
    return applyDecorators(
        ApiContratoBody(AprobarIncidenciasSchema),
        ApiOperacionDocumentada({
            summary: 'Aprobar incidencias del período',
            description: 'Confirma hasta cien resúmenes completos, vigentes y sin pendientes de forma atómica. Permite filtrar por colaborador.',
            roles: ['ADMIN', 'RRHH'],
            respuesta: { type: 'object', properties: { periodo: { type: 'string' }, registros_aprobados: { type: 'integer' } } }
        })
    );
}
export function ApiSwaggerListarIncidencias() {
    return applyDecorators(
        ApiContratoQuery(ListarIncidenciasQuerySchema),
        ApiOperacionDocumentada({
            summary: 'Listar incidencias mensuales',
            description: 'Filtra por período, área, estado y búsqueda por documento o nombre.',
            roles: ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'],
            respuesta: { type: 'array', items: respuestaIncidencia },
            paginada: true
        })
    );
}
