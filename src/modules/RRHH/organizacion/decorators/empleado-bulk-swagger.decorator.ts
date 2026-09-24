import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiExtension,
} from '@nestjs/swagger';

/**
 * Decorador para documentar el controlador de Carga Masiva de Empleados en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerEmpleadosBulkController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Carga Masiva de Empleados (Two-Step Upload)'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH']),
  );
}

/**
 * Decorador para documentar el endpoint de carga directa/legacy en un solo paso (POST /api/rrhh/empleados/bulk).
 */
export function ApiSwaggerUploadBulk() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cargar Archivo Masivo de Empleados (Encolamiento Directo)',
      description:
        'Recibe un archivo Excel (.xlsx) o CSV (.csv) con el legajo de personal, divide los registros en lotes de 50 y los encola en BullMQ + Redis.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Archivo Excel (.xlsx) o CSV (.csv) con la estructura de empleados.',
          },
        },
      },
    }),
    ApiResponse({
      status: 202,
      description: 'Archivo aceptado y encolado exitosamente para procesamiento en segundo plano.',
    }),
    ApiResponse({
      status: 400,
      description: 'Formato de petición inválido, archivo ausente o extensión no soportada.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT ausente o inválido.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Se requieren permisos de ADMIN o RRHH.',
    }),
  );
}

/**
 * Decorador para documentar el endpoint de pre-validación (Dry Run) (POST /api/rrhh/empleados/bulk/validar).
 */
export function ApiSwaggerValidateBulk() {
  return applyDecorators(
    ApiOperation({
      summary: 'Pre-validar Archivo Masivo (Dry Run & Staging)',
      description:
        'Examina y sanitiza un archivo Excel (.xlsx) o CSV sin realizar escrituras en la base de datos. Retorna un reporte detallado con conteos de filas válidas, filas inválidas y detalle de errores por celda.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Archivo Excel (.xlsx) o CSV (.csv) a pre-validar.',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Reporte de pre-visualización generado exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'El archivo está vacío, no es multipart o no tiene formato .xlsx / .csv.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.',
    }),
  );
}

/**
 * Decorador para documentar el endpoint de confirmación de filas limpias (POST /api/rrhh/empleados/bulk/confirmar).
 */
export function ApiSwaggerConfirmBulk() {
  return applyDecorators(
    ApiOperation({
      summary: 'Confirmar e Ingestar Filas Válidas',
      description:
        'Recibe el arreglo de filas validadas aprobado por el usuario, crea el registro del Job en PostgreSQL y encola los lotes en BullMQ.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['filas_validas_data'],
        properties: {
          filas_validas_data: {
            type: 'array',
            description: 'Arreglo de objetos de empleados sanitizados listos para su persistencia.',
            items: {
              type: 'object',
              required: ['tipo_documento', 'nro_documento'],
              properties: {
                tipo_documento: { type: 'string', example: 'DNI' },
                nro_documento: { type: 'string', example: '70998877' },
                nombre: { type: 'string', example: 'Roberto' },
                apellido: { type: 'string', example: 'Flores Gomez' },
                area: { type: 'string', example: 'Oficina Central' },
                cargo: { type: 'string', example: 'Contador Principal' },
                jornada: { type: 'string', example: 'Turno Mañana (Oficina)' },
                fecha_nacimiento: { type: 'string', example: '1992-04-10' },
                fecha_inicio: { type: 'string', example: '2026-01-15' },
                asig_familiar: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 202,
      description: 'Lotes de empleados confirmados y encolados en BullMQ exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'No se enviaron filas válidas para procesar.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.',
    }),
  );
}

/**
 * Decorador para documentar la consulta del estado y progreso de un Job (GET /api/rrhh/empleados/bulk/:jobId).
 */
export function ApiSwaggerGetBulkStatus() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consultar Estado y Progreso de Carga Masiva',
      description:
        'Obtiene el estado actual de un trabajo encolado (EN_COLA, PROCESANDO, COMPLETADO, FALLIDO) con el recuento de filas procesadas, fallidas y lista de errores.',
    }),
    ApiParam({
      name: 'jobId',
      description: 'UUID único del trabajo de carga masiva.',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiResponse({
      status: 200,
      description: 'Estado del trabajo consultado exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Identificador jobId ausente o inválido.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.',
    }),
    ApiResponse({
      status: 404,
      description: 'El trabajo especificado no existe o pertenece a otro usuario.',
    }),
  );
}

/**
 * Decorador para documentar la descarga de la plantilla oficial en CSV (GET /api/rrhh/empleados/bulk/plantilla).
 */
export function ApiSwaggerDownloadTemplate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Descargar Plantilla Oficial CSV',
      description:
        'Descarga un archivo CSV con las cabeceras estándar y filas de ejemplo compatibles con el motor de ingesta.',
    }),
    ApiResponse({
      status: 200,
      description: 'Archivo plantilla CSV descargado con éxito.',
      content: {
        'text/csv': {
          schema: {
            type: 'string',
            example:
              'tipo_documento,nro_documento,nombre,apellido,area,cargo,jornada,fecha_nacimiento,fecha_inicio,asig_familiar\n',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.',
    }),
  );
}