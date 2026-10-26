//src/modules/core/audit/decorators/audit-swagger.decorator.ts
import { ApiOperacionDocumentada, esquemaContrato, ApiContratoBody, ApiContratoQuery } from '@/common/decorators/api-contrato.decorator';
import { CreateAuditSchema, AuditResumenSchema, ObtenerAuditQuerySchema  } from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

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