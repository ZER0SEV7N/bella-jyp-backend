//src/modules/RRHH/organizacion/decorators/empleado-bulk-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  CargaMasivaFilaSchema,
  ConfirmarCargaMasivaSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtension,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

const ROLES_BULK = ['ADMIN', 'RRHH'];
const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para carga masiva.
 */
export function ApiSwaggerEmpleadosBulkController() {
  return applyDecorators(
    ApiTags('RRHH - Carga Masiva de Empleados (Two-Step Ingestion)'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/empleados-bulk/validar`.
 */
export function ApiSwaggerValidateBulk() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description:
              'Archivo Excel (.xlsx) o CSV (.csv) con las filas de colaboradores.',
          },
        },
      },
    }),
    ApiOperacionDocumentada({
      summary: 'Paso 1: Pre-validar archivo de carga masiva',
      description:
        'Lee un archivo `.xlsx` o `.csv` sin escribir en base de datos, normaliza encabezados y valores, y valida cada fila con `CargaMasivaFilaSchema`. Devuelve conteos, errores por fila/columna y las filas válidas listas para confirmar.',
      roles: ROLES_BULK,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            example: 'https://api.jyp.com/bulk/pre-validation',
          },
          title: { type: 'string', example: 'Reporte de Pre-Visualización' },
          status: { type: 'integer', example: 200 },
          data: {
            type: 'object',
            properties: {
              total_filas: { type: 'integer' },
              filas_validas: { type: 'integer' },
              filas_invalidas: { type: 'integer' },
              errores_detalle: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    fila: { type: 'integer' },
                    columna: { type: 'string' },
                    valor_recibido: { nullable: true },
                    mensaje: { type: 'string' },
                  },
                },
              },
              filas_validas_data: {
                type: 'array',
                items: esquemaContrato(CargaMasivaFilaSchema),
              },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

/**
 * Documenta `POST /api/v1/rrhh/empleados-bulk/confirmar`.
 */
export function ApiSwaggerConfirmBulk() {
  return applyDecorators(
    ApiContratoBody(ConfirmarCargaMasivaSchema),
    ApiOperacionDocumentada({
      summary: 'Paso 2: Confirmar y encolar carga masiva',
      description:
        'Valida cada fila contra `CargaMasivaFilaSchema`, crea un trabajo `CargaMasivaJob` en estado `EN_COLA`, divide los registros en lotes de 50 y los encola en BullMQ (`rrhh-bulk-queue`).',
      roles: ROLES_BULK,
      status: 202,
      respuesta: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            example: 'https://api.jyp.com/jobs/accepted',
          },
          title: { type: 'string', example: 'Procesamiento en Cola' },
          status: { type: 'integer', example: 202 },
          detail: { type: 'string' },
          jobId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/empleados-bulk/:jobId`.
 */
export function ApiSwaggerGetBulkStatus() {
  return applyDecorators(
    ApiIdentificador('jobId'),
    ApiOperacionDocumentada({
      summary: 'Consultar estado de carga masiva',
      description:
        'Consulta el progreso de un trabajo de carga masiva en `CargaMasivaJob`. Solo permite consultar trabajos creados por el usuario autenticado (404 si no existe o pertenece a otro usuario).',
      roles: ROLES_BULK,
      respuesta: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              estado: {
                type: 'string',
                enum: ['EN_COLA', 'PROCESANDO', 'COMPLETADO', 'FALLIDO'],
              },
              total_registros: { type: 'integer' },
              procesados: { type: 'integer' },
              fallidos: { type: 'integer' },
              errores_detalle: { nullable: true },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/empleados-bulk/plantilla`.
 */
export function ApiSwaggerDownloadTemplate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Descargar plantilla de carga masiva (.xlsx)',
      description:
        'Genera y descarga un libro Excel con las 37 columnas esperadas por el pipeline de carga masiva y dos filas de ejemplo con formato de texto en códigos numéricos.',
    }),
    ApiExtension('x-roles', ROLES_BULK),
    ApiProduces(MIME_XLSX),
    ApiResponse({
      status: 200,
      description: 'Archivo Excel de plantilla descargado correctamente.',
      content: {
        [MIME_XLSX]: { schema: { type: 'string', format: 'binary' } },
      },
    })
  );
}
