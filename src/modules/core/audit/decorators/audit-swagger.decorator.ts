//src/modules/core/audit/decorators/audit-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  ActividadAuditoriaQuerySchema,
  AuditResumenSchema,
  CreateAuditSchema,
  DetalleActividadAuditoriaSchema,
  FilaActividadAuditoriaSchema,
  LineaTiempoAfectadoQuerySchema,
  ObtenerAuditQuerySchema,
  TIPOS_AFECTADO_CON_ID_AUDITORIA,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import type { SchemaObject } from '@nestjs/swagger';
import {
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

const cambioAuditoriaSchema: SchemaObject = {
  type: 'object',
  properties: {
    campo: { type: 'string' },
    etiqueta: { type: 'string' },
    antes: { nullable: true },
    despues: { nullable: true },
    protegido: { type: 'boolean' },
  },
};

const RESPUESTAS_ERROR_AUDITORIA = [
  ApiResponse({
    status: 400,
    description:
      'Solicitud inválida. Los filtros, la paginación o los parámetros no cumplen el contrato.',
  }),
  ApiResponse({
    status: 401,
    description: 'No autorizado. El usuario no tiene un token válido.',
  }),
  ApiResponse({
    status: 403,
    description:
      'Prohibido. El rol no puede consultar la auditoría o la tabla pedida.',
  }),
];

/**
 * Decorador personalizado para agrupar y autenticar los endpoints de auditoría en Swagger.
 */
export function ApiSwaggerAuditoriaController() {
  return applyDecorators(
    ApiTags('Modulo Auditoria'),
    ApiBearerAuth('JWT-auth')
  );
}

/**
 * Documenta `POST /api/v1/core/audit/logs`: registro manual de un evento de auditoría.
 */
export function ApiSwaggerCrearAuditoria() {
  return applyDecorators(
    ApiContratoBody(CreateAuditSchema),
    ApiOperacionDocumentada({
      summary: 'Crear registro de auditoría',
      description:
        'Registra manualmente un evento en audit_log tomando el usuario y la IP desde el contexto de la solicitud y sanitizando campos sensibles en los snapshots.',
      roles: ['ADMIN', 'CONTADOR', 'ASISTENTE', 'RRHH'],
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          usuario_id: { type: 'string', format: 'uuid', nullable: true },
          accion: { type: 'string' },
          tabla_afectada: { type: 'string' },
          registro_id: { type: 'string', format: 'uuid' },
          valores_antes: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
          },
          valores_despues: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
          },
          direccion_ip: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          afectado_tipo: { type: 'string', nullable: true },
          afectado_id: { type: 'string', format: 'uuid', nullable: true },
        },
      },
    }),
    ...RESPUESTAS_ERROR_AUDITORIA
  );
}

/**
 * Documenta `GET /api/v1/core/audit/logs`: listado paginado de bitácoras técnicas de auditoría.
 */
export function ApiSwaggerListarAuditoria() {
  return applyDecorators(
    ApiContratoQuery(ObtenerAuditQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar registros de auditoría',
      description:
        'Obtiene logs paginados ordenados del más reciente al más antiguo (sin valores_antes ni valores_despues). ADMIN ve todas las tablas; RRHH solo tablas de su ámbito; CONTADOR solo logs propios o de ASISTENTE.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      paginada: true,
      respuesta: { type: 'array', items: esquemaContrato(AuditResumenSchema) },
    }),
    ...RESPUESTAS_ERROR_AUDITORIA
  );
}

/**
 * Documenta `GET /api/v1/core/audit/logs/:id`: detalle técnico de un registro de auditoría por ID.
 */
export function ApiSwaggerObtenerAuditoriaPorId() {
  return applyDecorators(
    ApiIdentificador('id', true),
    ApiOperacionDocumentada({
      summary: 'Obtener registro de auditoría por ID',
      description:
        'Devuelve el registro técnico junto con cambios campo por campo y campos_modificados, ocultando huellas de campos protegidos. RRHH recibe 403 fuera de sus tablas permitidas y CONTADOR solo accede a logs propios o de ASISTENTE.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          usuario_id: { type: 'string', format: 'uuid', nullable: true },
          accion: { type: 'string' },
          tabla_afectada: { type: 'string' },
          registro_id: { type: 'string', format: 'uuid' },
          valores_antes: { nullable: true },
          valores_despues: { nullable: true },
          direccion_ip: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          afectado_tipo: { type: 'string', nullable: true },
          afectado_id: { type: 'string', format: 'uuid', nullable: true },
          cambios: { type: 'array', items: cambioAuditoriaSchema },
          campos_modificados: { type: 'array', items: { type: 'string' } },
        },
      },
    }),
    ...RESPUESTAS_ERROR_AUDITORIA,
    ApiResponse({
      status: 404,
      description: 'No existe un registro de auditoría con el ID indicado.',
    })
  );
}

/**
 * Documenta `GET /api/v1/core/audit/historial/:tabla/:registroId`: historial paginado de cambios de un registro.
 */
export function ApiSwaggerObtenerHistorialRegistro() {
  return applyDecorators(
    ApiIdentificador('tabla', false),
    ApiIdentificador('registroId', true),
    ApiQuery({
      name: 'page',
      required: false,
      description: 'Número de página (por defecto 1).',
      schema: { type: 'integer', minimum: 1, default: 1 },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Registros por página (por defecto 20, máximo 100).',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    }),
    ApiOperacionDocumentada({
      summary: 'Obtener historial de auditoría de un registro',
      description:
        'Devuelve el historial paginado de cambios de una tabla y registro específico, con actor, diferencias campo por campo y campos_modificados. Respeta las restricciones por rol sobre tablas (RRHH) y actores (CONTADOR).',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      paginada: true,
      respuesta: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fecha: { type: 'string', format: 'date-time' },
            accion: { type: 'string' },
            tabla_afectada: { type: 'string' },
            registro_id: { type: 'string', format: 'uuid' },
            usuario: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nombre: { type: 'string' },
                rol: { type: 'string' },
              },
            },
            cambios: { type: 'array', items: cambioAuditoriaSchema },
            campos_modificados: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    }),
    ...RESPUESTAS_ERROR_AUDITORIA
  );
}

/**
 * Documenta `GET /api/v1/core/audit/actividad`: actividad auditada en lenguaje de negocio, con los
 * filtros de `/logs` más `afectado_tipo`, `afectado_id`, `desde` y `hasta`.
 */
export function ApiSwaggerListarActividad() {
  return applyDecorators(
    ApiContratoQuery(ActividadAuditoriaQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar actividad de auditoría',
      description:
        'Lista paginada y legible de la actividad (fechas `desde` y `hasta` interpretadas en hora Lima): acción de negocio, módulo, actor, afectado, resumen, registro_id y campos modificados. Requiere rol ADMIN, RRHH o CONTADOR.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      paginada: true,
      respuesta: {
        type: 'array',
        items: esquemaContrato(FilaActividadAuditoriaSchema),
      },
    }),
    ...RESPUESTAS_ERROR_AUDITORIA
  );
}

/**
 * Documenta `GET /api/v1/core/audit/actividad/:id`: una fila de actividad con la lista de cambios.
 */
export function ApiSwaggerObtenerActividadPorId() {
  return applyDecorators(
    ApiIdentificador('id', true),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de actividad de auditoría',
      description:
        'Devuelve la fila de actividad más `cambios`: IDs reemplazados por nombres, enums con etiqueta legible, fechas normalizadas y listas (como el horario) comparadas por elemento. Los datos bancarios y el CUSPP se marcan como `protegido`.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      respuesta: esquemaContrato(DetalleActividadAuditoriaSchema),
    }),
    ...RESPUESTAS_ERROR_AUDITORIA,
    ApiResponse({
      status: 404,
      description: 'No existe el registro o el rol no puede ver su tabla.',
    })
  );
}

/**
 * Documenta `GET /api/v1/core/audit/afectados/:tipo/:id`: línea de tiempo de un empleado, área,
 * cargo o jornada.
 */
export function ApiSwaggerLineaTiempoAfectado() {
  return applyDecorators(
    ApiParam({
      name: 'tipo',
      required: true,
      description: 'Tipo de afectado.',
      schema: { type: 'string', enum: [...TIPOS_AFECTADO_CON_ID_AUDITORIA] },
    }),
    ApiIdentificador('id', true),
    ApiContratoQuery(LineaTiempoAfectadoQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Línea de tiempo de un afectado',
      description:
        'Cambios de todas las tablas relacionadas con un empleado, área, cargo o jornada, del más reciente al más antiguo, con el mismo formato de fila que `/actividad` y rango de fechas en hora Lima.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      paginada: true,
      respuesta: {
        type: 'array',
        items: esquemaContrato(FilaActividadAuditoriaSchema),
      },
    }),
    ...RESPUESTAS_ERROR_AUDITORIA
  );
}
