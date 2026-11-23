//src/modules/asistencia/decorator/incidencias-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  AprobarIncidenciasSchema,
  GenerarIncidenciasPeriodoSchema,
  IncidenciaDetalleSchema,
  ListarIncidenciasQuerySchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { respuestaFilaIncidencia } from './asistencia-respuestas.swagger';
import { TotalesIncidenciasQuerySchema } from '../helpers/filtro-incidencias.helper';

/**
 * Decorador para aplicar configuraciones comunes a los endpoints del controlador de incidencias.
 * Incluye etiquetas de Swagger, autenticación y errores estándar de operación.
 */
export function ApiSwaggerIncidenciasController() {
  return applyDecorators(
    ApiTags('Módulo Asistencia - Cierre e Incidencias Mensuales'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

export function ApiSwaggerGenerarCierre() {
  return applyDecorators(
    ApiContratoBody(GenerarIncidenciasPeriodoSchema),
    ApiOperacionDocumentada({
      summary: 'Generar resumen mensual de asistencia',
      description:
        'Procesa un lote (hasta 100 colaboradores) por período, área o colaborador cuyo vínculo se cruza con el mes. Rechaza períodos futuros (400) o sin colaboradores (404), devuelve siguiente_cursor cuando hay otra página y deja los resúmenes en estado PENDIENTE.',
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
              properties: {
                empleado_id: { type: 'string', format: 'uuid' },
                id: { type: 'string', format: 'uuid' },
                estado: { type: 'string' },
                error: { type: 'string' },
              },
            },
          },
        },
      },
    })
  );
}

export function ApiSwaggerAprobarIncidencias() {
  return applyDecorators(
    ApiContratoBody(AprobarIncidenciasSchema),
    ApiOperacionDocumentada({
      summary: 'Aprobar incidencias del período',
      description:
        'Aprueba hasta cien resúmenes pendientes de forma atómica (opcionalmente filtrando por colaborador). Verifica planilla abierta, resumen vigente, completo, sin pendientes ni días sin jornada y fuentes sin cambios, rechazando con conflicto (409) y el motivo si alguno no cumple.',
      roles: ['ADMIN', 'RRHH'],
      respuesta: {
        type: 'object',
        properties: {
          periodo: { type: 'string' },
          registros_aprobados: { type: 'integer' },
        },
      },
    })
  );
}

export function ApiSwaggerListarIncidencias() {
  return applyDecorators(
    ApiContratoQuery(ListarIncidenciasQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar incidencias mensuales',
      description:
        'Filtra por período, área, estado y búsqueda por documento o nombre. Cada fila incluye acciones permitidas (aprobar, rechazar, reabrir) con null o el motivo de bloqueo, incluida planilla no abierta.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'],
      respuesta: { type: 'array', items: respuestaFilaIncidencia },
      paginada: true,
    })
  );
}

/**
 * Documentación Swagger para consultar los totales por estado del cierre mensual de asistencia.
 *
 * @returns Decoradores Swagger aplicados al endpoint de totales de incidencias.
 */
export function ApiSwaggerTotalesIncidencias() {
  return applyDecorators(
    ApiContratoQuery(TotalesIncidenciasQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Obtener totales de incidencias por estado',
      description:
        'Devuelve la cantidad de resúmenes en estado PENDIENTE, APROBADO y RECHAZADO para un período y área opcional, usando el mismo filtro base que el listado sin estado ni búsqueda.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'],
      respuesta: {
        type: 'object',
        properties: {
          PENDIENTE: { type: 'integer' },
          APROBADO: { type: 'integer' },
          RECHAZADO: { type: 'integer' },
        },
      },
    })
  );
}

export function ApiSwaggerListarIncidenciaPorId() {
  return applyDecorators(
    ApiIdentificador('id', true),
    ApiOperacionDocumentada({
      summary: 'Obtener incidencia por ID',
      description:
        'Recupera el detalle completo de un resumen mensual de incidencias por su UUID, incluyendo los datos básicos del colaborador.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      respuesta: esquemaContrato(IncidenciaDetalleSchema),
    })
  );
}
