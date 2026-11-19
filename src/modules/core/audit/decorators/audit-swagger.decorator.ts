//src/modules/core/audit/decorators/audit-swagger.decorator.ts
import { ApiOperacionDocumentada, esquemaContrato, ApiContratoBody, ApiContratoQuery } from '@/common/decorators/api-contrato.decorator';
import { CreateAuditSchema, AuditResumenSchema, ObtenerAuditQuerySchema, TIPOS_AFECTADO_AUDITORIA, TIPOS_AFECTADO_CON_ID_AUDITORIA } from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

/**
 * Decorador personalizado para documentar los endpoints de auditoría en Swagger.
 * @param tag - Nombre de la etiqueta para agrupar los endpoints en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, CONTADOR para autorización.
 */
export function ApiSwaggerAuditoriaController() {
  return applyDecorators(ApiTags('Modulo Auditoria'), ApiBearerAuth('JWT-auth'));
}

/**
 * Decorador para documentar el endpoint de creación de un registro de auditoría en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerCrearAuditoria() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Registro de Auditoría',
      description: 'Registra un nuevo evento de auditoría en el sistema. Requiere rol ADMIN o CONTADOR.',
    }),
    ApiContratoBody(CreateAuditSchema),
    ApiResponse({
      status: 201,
      description: 'Registro de auditoría creado exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos. Devuelve un mensaje de error.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. El usuario no tiene un token válido.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los permisos necesarios para realizar esta acción.',
    })
  );
}
/**
 * Decorador para documentar el endpoint de obtención de registros de auditoría en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param querySchema - Esquema de validación para los parámetros de consulta.
 * @Query - Esquema de validación para los parámetros de consulta.
 * @Query - Page: number - Número de página para la paginación.
 * @Query - Limit: number - Cantidad de registros por página para la paginación.
 * @Query - tabla_afectada: string - Nombre de la tabla afectada para filtrar los registros.
 * @Query - accion: string - Acción realizada para filtrar los registros.
 * @Query - usuario_id: string - ID del usuario que realizó la acción para filtrar los registros.
 * @Query - registro_id: string - ID del registro afectado para filtrar los registros.
 * @returns Un objeto con los registros de auditoría filtrados y paginados según los parámetros proporcionados.
 */
export function ApiSwaggerListarAuditoria() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar Registros de Auditoría',
      description:
        'Obtiene una lista de registros de auditoría filtrados y paginados según los parámetros proporcionados. Requiere rol ADMIN o CONTADOR.',
    }),
    ApiContratoQuery(ObtenerAuditQuerySchema),

    ApiResponse({
      status: 200,
      description: 'Retorna un objeto con los registros de auditoría filtrados y paginados según los parámetros proporcionados.',
    }),
    ApiResponse({
      status: 400,
      description: 'Solicitud inválida. Devuelve un mensaje de error si los parámetros de consulta no son válidos.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. El usuario no tiene un token válido.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los permisos necesarios para realizar esta acción.',
    }),
    ApiOperacionDocumentada({
      summary: 'Listar auditoría',
      description: 'Tabla resumida; los deltas se consultan por ID.',
      roles: ['ADMIN', 'RRHH', 'CONTADOR'],
      paginada: true,
      respuesta: { type: 'array', items: esquemaContrato(AuditResumenSchema) },
    })
  );
}

/**
 * Decorador para documentar el endpoint de obtención de un registro de auditoría por ID en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param querySchema - Esquema de validación para los parámetros de consulta.
 */
export function ApiSwaggerObtenerAuditoriaPorId() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener Registro de Auditoría por ID',
      description: 'Obtiene un registro de auditoría específico por su ID. Requiere rol ADMIN o CONTADOR.',
    }),
    ApiQuery({
      name: 'id',
      required: true,
      description: 'ID del registro de auditoría a obtener.',
      schema: { type: 'string' },
    }),
    ApiResponse({
      status: 200,
      description: 'Retorna el registro de auditoría correspondiente al ID proporcionado.',
    }),
    ApiResponse({
      status: 400,
      description: 'Solicitud inválida. Devuelve un mensaje de error si el ID no es válido.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. El usuario no tiene un token válido.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los permisos necesarios para realizar esta acción.',
    }),
    ApiResponse({
      status: 404,
      description: 'No encontrado. No existe un registro de auditoría con el ID proporcionado.',
    })
  );
}

/**
 * Decorador para documentar el endpoint de obtención del historial de auditoría de un registro específico en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param querySchema - Esquema de validación para los parámetros de consulta.
 * @Query - tabla: string - Nombre de la tabla afectada para filtrar los registros.
 * @Query - registroId: string - ID del registro afectado para filtrar los registros.
 * @Query - page: number - Número de página para la paginación.
 * @Query - limit: number - Cantidad de registros por página para la paginación.
 * @returns Un objeto con el historial de auditoría del registro específico, incluyendo los cambios realizados en sus campos.
 */
export function ApiSwaggerObtenerHistorialRegistro() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener Historial de Auditoría de un Registro',
      description: 'Obtiene el historial de auditoría de un registro específico, incluyendo los cambios realizados en sus campos. Requiere rol ADMIN, RRHH o CONTADOR.',
    }),
    ApiQuery({
      name: 'tabla',
      required: true,
      description: 'Nombre de la tabla afectada para filtrar los registros.',
      schema: { type: 'string' },
    }),
    ApiQuery({
      name: 'registroId',
      required: true,
      description: 'ID del registro afectado para filtrar los registros.',
      schema: { type: 'string' },
    }),
    ApiQuery({
      name: 'page',
      required: false,
      description: 'Número de página para la paginación (opcional, por defecto 1).',
      schema: { type: 'number', default: 1 },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Cantidad de registros por página para la paginación (opcional, por defecto 20).',
      schema: { type: 'number', default: 20 },
    }),
    ApiResponse({
      status: 200,
      description: 'Retorna un objeto con el historial de auditoría del registro específico, incluyendo los cambios realizados en sus campos.',
    }),
    ApiResponse({
      status: 400,
      description: 'Solicitud inválida. Devuelve un mensaje de error si los parámetros de consulta no son válidos.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. El usuario no tiene un token válido.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los permisos necesarios para realizar esta acción.',
    }),
    ApiResponse({
      status: 404,
      description: 'No encontrado. No existe un historial de auditoría para el registro especificado.',
    })
  );
}

const RESPUESTAS_ERROR_ACTIVIDAD = [
  ApiResponse({ status: 400, description: 'Solicitud inválida. Los filtros, la paginación o los parámetros no cumplen el contrato.' }),
  ApiResponse({ status: 401, description: 'No autorizado. El usuario no tiene un token válido.' }),
  ApiResponse({ status: 403, description: 'Prohibido. El rol no puede consultar la auditoría o la tabla pedida.' }),
];

const PARAMETROS_FECHAS_ACTIVIDAD = [
  ApiQuery({ name: 'desde', required: false, description: 'Fecha inicial del rango (AAAA-MM-DD), inclusive.', schema: { type: 'string', format: 'date' } }),
  ApiQuery({ name: 'hasta', required: false, description: 'Fecha final del rango (AAAA-MM-DD), inclusive. No puede ser anterior a `desde`.', schema: { type: 'string', format: 'date' } }),
];

/**
 * Documenta `GET /api/v1/core/audit/actividad`: actividad auditada en lenguaje de negocio, con los
 * filtros de `/logs` más `afectado_tipo`, `afectado_id`, `desde` y `hasta`.
 */
export function ApiSwaggerListarActividad() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar actividad de auditoría',
      description: 'Lista paginada y legible de la actividad: acción de negocio, módulo, actor, afectado, resumen y campos modificados. Requiere rol ADMIN, RRHH o CONTADOR; RRHH solo ve las tablas de su ámbito.',
    }),
    ApiQuery({ name: 'page', required: false, description: 'Número de página (por defecto 1).', schema: { type: 'integer', minimum: 1, default: 1 } }),
    ApiQuery({ name: 'limit', required: false, description: 'Filas por página (por defecto 50, máximo 100).', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }),
    ApiQuery({ name: 'tabla_afectada', required: false, description: 'Filtra por el módulo técnico (`modulo` de la respuesta).', schema: { type: 'string', maxLength: 100 } }),
    ApiQuery({ name: 'accion', required: false, description: 'Filtra por la acción técnica registrada (CREATE, UPDATE, DELETE...).', schema: { type: 'string', maxLength: 100 } }),
    ApiQuery({ name: 'usuario_id', required: false, description: 'Filtra por el usuario que hizo el cambio.', schema: { type: 'string', format: 'uuid' } }),
    ApiQuery({ name: 'registro_id', required: false, description: 'Filtra por el ID de la fila modificada.', schema: { type: 'string', format: 'uuid' } }),
    ApiQuery({ name: 'afectado_tipo', required: false, description: 'Filtra por el tipo de afectado.', schema: { type: 'string', enum: [...TIPOS_AFECTADO_AUDITORIA] } }),
    ApiQuery({ name: 'afectado_id', required: false, description: 'Filtra por el ID del afectado (empleado, área, cargo o jornada).', schema: { type: 'string', format: 'uuid' } }),
    ...PARAMETROS_FECHAS_ACTIVIDAD,
    ApiResponse({ status: 200, description: 'Página de actividad: `data` con las filas y `meta` con el total y la paginación. Cada fila incluye `registro_id`, el ID de la fila modificada en su tabla (`modulo`), para enlazar a su pantalla; por ejemplo, el de la solicitud cuando `modulo` es `solicitud`.' }),
    ...RESPUESTAS_ERROR_ACTIVIDAD,
  );
}

/**
 * Documenta `GET /api/v1/core/audit/actividad/:id`: una fila de actividad con la lista de cambios.
 */
export function ApiSwaggerObtenerActividadPorId() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener detalle de actividad de auditoría',
      description: 'Devuelve la fila de actividad más `cambios`: IDs reemplazados por nombres, enums con etiqueta legible, fechas normalizadas y listas (como el horario) comparadas por elemento. Los datos bancarios y el CUSPP se marcan como `protegido`.',
    }),
    ApiParam({ name: 'id', required: true, description: 'ID del registro de auditoría.', schema: { type: 'string', format: 'uuid' } }),
    ApiResponse({ status: 200, description: 'Fila de actividad con `cambios`. Incluye `registro_id`, el ID de la fila modificada en su tabla (`modulo`), para enlazar a su pantalla; por ejemplo, el de la solicitud cuando `modulo` es `solicitud`.' }),
    ...RESPUESTAS_ERROR_ACTIVIDAD,
    ApiResponse({ status: 404, description: 'No existe el registro o el rol no puede ver su tabla.' }),
  );
}

/**
 * Documenta `GET /api/v1/core/audit/afectados/:tipo/:id`: línea de tiempo de un empleado, área,
 * cargo o jornada.
 */
export function ApiSwaggerLineaTiempoAfectado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Línea de tiempo de un afectado',
      description: 'Cambios de todas las tablas relacionadas con un empleado, área, cargo o jornada, del más reciente al más antiguo, con el mismo formato de fila que `/actividad`.',
    }),
    ApiParam({ name: 'tipo', required: true, description: 'Tipo de afectado.', schema: { type: 'string', enum: [...TIPOS_AFECTADO_CON_ID_AUDITORIA] } }),
    ApiParam({ name: 'id', required: true, description: 'ID del afectado.', schema: { type: 'string', format: 'uuid' } }),
    ApiQuery({ name: 'page', required: false, description: 'Número de página (por defecto 1).', schema: { type: 'integer', minimum: 1, default: 1 } }),
    ApiQuery({ name: 'limit', required: false, description: 'Filas por página (por defecto 20, máximo 100).', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }),
    ...PARAMETROS_FECHAS_ACTIVIDAD,
    ApiResponse({ status: 200, description: 'Página de actividad del afectado: `data` y `meta`. Cada fila incluye `registro_id`, el ID de la fila modificada en su tabla (`modulo`), para enlazar a su pantalla; por ejemplo, el de la solicitud cuando `modulo` es `solicitud`.' }),
    ...RESPUESTAS_ERROR_ACTIVIDAD,
  );
}
