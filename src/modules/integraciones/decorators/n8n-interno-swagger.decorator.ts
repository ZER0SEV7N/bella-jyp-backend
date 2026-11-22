//src/modules/integraciones/decorators/n8n-interno-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  PaginaDatosExportacionSchema,
  ReclamarTrabajoSchema,
  ResultadoIntegracionSchema,
  SobreN8nSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import type { SchemaObject } from '@nestjs/swagger';
import { ApiHeader, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

const schemaErrorN8n: SchemaObject = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'integer' },
    detail: { type: 'string' },
    instance: { type: 'string' },
  },
};

function ApiErroresN8nInterno() {
  const errores = [
    [400, 'La entrada o los parámetros de ruta/consulta no son válidos.'],
    [
      401,
      'Firma HMAC ausente, fuera de ventana temporal, inválida o nonce repetido.',
    ],
    [404, 'Trabajo de integración o planilla cerrada no encontrada.'],
    [
      409,
      'Conflicto de estado, concesión de ejecución inválida o fuentes modificadas.',
    ],
    [503, 'La integración HMAC todavía no está configurada en el servidor.'],
  ] as const;

  return applyDecorators(
    ...errores.map(([status, description]) =>
      ApiResponse({ status, description, schema: schemaErrorN8n })
    )
  );
}

/**
 * Decorador de nivel controlador para el canal interno M2M consumido exclusivamente por n8n.
 * Documenta las cabeceras HMAC exigidas por `FirmaN8NGuard` sin autenticación JWT.
 */
export function ApiSwaggerN8nInternoController() {
  return applyDecorators(
    ApiTags('Integraciones internas (n8n)'),
    ApiHeader({
      name: 'x-jyp-timestamp',
      required: true,
      description:
        'Marca temporal Unix en segundos (10 dígitos). Debe estar dentro de ±300 segundos respecto al reloj del servidor.',
      schema: { type: 'string', pattern: '^\\d{10}$' },
    }),
    ApiHeader({
      name: 'x-jyp-nonce',
      required: true,
      description:
        'Identificador UUID de un solo uso reservado en Redis por 600 segundos para prevenir reenvíos.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiHeader({
      name: 'x-jyp-signature',
      required: true,
      description:
        'Firma HMAC-SHA256 de la petición (método, URL, timestamp, nonce y cuerpo JSON canónico) firmada con N8N_WEBHOOK_SECRET.',
      schema: { type: 'string' },
    }),
    ApiErroresN8nInterno()
  );
}

/**
 * Documenta `POST /api/v1/integraciones/n8n/validar`.
 */
export function ApiSwaggerValidarTrabajoN8n() {
  return applyDecorators(
    ApiContratoBody(SobreN8nSchema),
    ApiOperacionDocumentada({
      summary: 'Validar existencia de trabajo de integración (solo n8n)',
      description:
        'Endpoint interno exclusivo para n8n (autenticado con firma HMAC mediante FirmaN8NGuard, sin JWT). Verifica que el trabajo exista antes de iniciar su ejecución.',
      roles: [],
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          trabajo_id: { type: 'string', format: 'uuid' },
        },
      },
    })
  );
}

/**
 * Documenta `POST /api/v1/integraciones/n8n/trabajos/:id/reclamar`.
 */
export function ApiSwaggerReclamarTrabajoN8n() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(ReclamarTrabajoSchema),
    ApiOperacionDocumentada({
      summary: 'Reclamar trabajo pendiente para ejecución (solo n8n)',
      description:
        "Endpoint interno exclusivo para n8n (autenticado con firma HMAC, sin JWT). Transiciona atómicamente el trabajo de PENDIENTE a PROCESANDO asignando `ejecucion_id` y devuelve la solicitud descifrada; si el trabajo es `RESET_PASSWORD` y está vencido, lo marca como FALLIDO y luego responde 409 ('El enlace de recuperación expiró.').",
      roles: [],
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tipo: { type: 'string' },
          periodo: { type: 'string', nullable: true },
          total: { type: 'integer' },
          solicitud: { type: 'object', additionalProperties: true },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description:
        "El trabajo ya fue reclamado o finalizado, o un trabajo RESET_PASSWORD vencido se marca como FALLIDO y responde 409 'El enlace de recuperación expiró.'.",
      schema: schemaErrorN8n,
    })
  );
}

/**
 * Documenta `GET /api/v1/integraciones/n8n/trabajos/:id/datos`.
 */
export function ApiSwaggerDatosExportacionN8n() {
  return applyDecorators(
    ApiIdentificador(),
    ApiQuery({
      name: 'pagina',
      required: true,
      description: 'Número de página 0-indexado (lotes de hasta 25 planillas).',
      schema: { type: 'integer', minimum: 0 },
    }),
    ApiQuery({
      name: 'ejecucion_id',
      required: true,
      description:
        'UUID de la ejecución que mantiene la concesión activa del trabajo.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiOperacionDocumentada({
      summary: 'Obtener página de datos de exportación (solo n8n)',
      description:
        'Endpoint interno exclusivo para n8n (autenticado con firma HMAC, sin JWT). Devuelve hasta 25 filas validadas y con cuentas descifradas mientras el trabajo siga en PROCESANDO para la ejecución indicada y no hayan cambiado el legajo ni la cuenta tras la solicitud.',
      roles: [],
      respuesta: esquemaContrato(PaginaDatosExportacionSchema),
    })
  );
}

/**
 * Documenta `POST /api/v1/integraciones/n8n/trabajos/:id/resultado`.
 */
export function ApiSwaggerFinalizarTrabajoN8n() {
  return applyDecorators(
    ApiIdentificador(),
    ApiQuery({
      name: 'ejecucion_id',
      required: true,
      description: 'UUID de la ejecución que finaliza el trabajo.',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiContratoBody(ResultadoIntegracionSchema),
    ApiOperacionDocumentada({
      summary: 'Finalizar trabajo de integración con resultado (solo n8n)',
      description:
        'Endpoint interno exclusivo para n8n (autenticado con firma HMAC, sin JWT). Registra el manifiesto de archivos y correos del trabajo en estado PROCESANDO y fija el estado final en COMPLETADO, PARCIAL o FALLIDO.',
      roles: [],
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          finalizado: { type: 'boolean' },
        },
      },
    })
  );
}
