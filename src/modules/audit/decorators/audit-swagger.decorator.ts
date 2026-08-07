//src/modules/audit/decorators/audit-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

/**
 * Decorador personalizado para documentar los endpoints de auditoría en Swagger.
 * @param tag - Nombre de la etiqueta para agrupar los endpoints en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, CONTADOR para autorización.
 */
export function ApiSwaggerAuditoriaController() {
  return applyDecorators(
    ApiTags('Modulo Auditoria'),
    ApiBearerAuth('JWT-auth'),
  );
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
      description:
        'Registra un nuevo evento de auditoría en el sistema. Requiere rol ADMIN o CONTADOR.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['accion', 'usuario_id', 'descripcion'],
        properties: {
          accion: { type: 'string', example: 'CREAR_EMPLEADO' },
          usuario_id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          descripcion: {
            type: 'string',
            example: 'Se creó un nuevo empleado con ID 123.',
          },
        },
      },
    }),
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
      description:
        'Prohibido. El usuario no tiene los permisos necesarios para realizar esta acción.',
    }),
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
    ApiQuery({
      name: 'page',
      description: 'Número de página para la paginación.',
      required: false,
      type: Number,
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      description: 'Cantidad de registros por página para la paginación.',
      required: false,
      type: Number,
      example: 50,
    }),
    ApiQuery({
      name: 'tabla_afectada',
      description: 'Nombre de la tabla afectada para filtrar los registros.',
      required: false,
      type: String,
      example: 'empleados',
    }),
    ApiQuery({
      name: 'accion',
      description: 'Acción realizada para filtrar los registros.',
      required: false,
      type: String,
      example: 'CREAR_EMPLEADO',
    }),
    ApiQuery({
      name: 'usuario_id',
      description:
        'ID del usuario que realizó la acción para filtrar los registros.',
      required: false,
      type: String,
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'registro_id',
      description: 'ID del registro afectado para filtrar los registros.',
      required: false,
      type: String,
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description:
        'Retorna un objeto con los registros de auditoría filtrados y paginados según los parámetros proporcionados.',
    }),
    ApiResponse({
      status: 400,
      description:
        'Solicitud inválida. Devuelve un mensaje de error si los parámetros de consulta no son válidos.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. El usuario no tiene un token válido.',
    }),
    ApiResponse({
      status: 403,
      description:
        'Prohibido. El usuario no tiene los permisos necesarios para realizar esta acción.',
    }),
  );
}
