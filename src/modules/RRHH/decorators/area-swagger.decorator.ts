//src/modules/RRHH/decorators/area-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';

/**
 * ===========================
 * AREAS
 * ===========================
 * Decorador personalizado para documentar los endpoints de autenticación en Swagger.
 * @param tag - Nombre de la etiqueta para agrupar los endpoints en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerAreasController() {
    return applyDecorators(ApiTags('Modulo RRHH - Areas'), ApiBearerAuth('JWT-auth'));
}

/**
 * Decorador para documentar el endopoint de creación de un área en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerCrearArea() {
    return applyDecorators(
        ApiOperation({
            summary: 'Crear Área',
            description: 'Registra una nueva área o departamento de la empresa en el sistema. Requiere rol ADMIN o RRHH.',
        }),
        ApiBody({
            schema: {
                type: 'object',
                required: ['nombre'],
                properties: {
                    nombre: { type: 'string', example: 'Recursos Humanos' },
                    descripcion: { type: 'string', example: 'Gestión de talento' },
                },
            }
        }),
        ApiResponse({
            status: 201,
            description: 'Área creada exitosamente.',
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
            description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.',
        }),
        ApiResponse({
            status: 409,
            description: 'Conflicto. El nombre del área ya existe.',
        })
    );
}

/**
 * Decorador para documentar el endpoint de actualización de un área en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del área a actualizar.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerActualizarArea() {
    return applyDecorators(
        ApiOperation({
            summary: 'Actualizar Área',
            description: 'Actualiza los detalles de un área existente. Requiere rol ADMIN o RRHH.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID del área a actualizar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiBody({
            schema: {
                type: 'object',
                properties: {
                    nombre: { type: 'string', example: 'Recursos Humanos' },
                    descripcion: { type: 'string', example: 'Gestión de talento' },
                },
            }
        }),
        ApiResponse({
            status: 200,
            description: 'Área actualizada exitosamente.',
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
            status: 404,
            description: 'No encontrado. El área con el ID proporcionado no existe.',
        }),
        ApiResponse({
            status: 403,
            description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.',
        })
    );
}
/**
 * Decorador para documentar el endpoint de desactivación de un área en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del área a desactivar.
 */
export function ApiSwaggerDesactivarArea() {
    return applyDecorators(
        ApiOperation({
            summary: 'Desactivar Área',
            description: 'Desactiva un área existente. Requiere rol ADMIN o RRHH.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID del área a desactivar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiResponse({
            status: 200,
            description: 'Área desactivada exitosamente.',
        }),
        ApiResponse({
            status: 401,
            description: 'No autorizado. El usuario no tiene un token válido.',
        }),
        ApiResponse({
            status: 404,
            description: 'No encontrado. El área con el ID proporcionado no existe.',
        }),
        ApiResponse({
            status: 403,
            description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.',
        })
    );
}

/**
 * Decorador para documentar el endpoint de reactivación de un área en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del área a reactivar.
 */
export function ApiSwaggerReactivarArea() {
    return applyDecorators(
        ApiOperation({
            summary: 'Reactivar Área',
            description: 'Reactiva un área desactivada. Requiere rol ADMIN o RRHH.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID del área a reactivar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiResponse({
            status: 200,
            description: 'Área reactivada exitosamente.',
        }),
        ApiResponse({
            status: 401,
            description: 'No autorizado. El usuario no tiene un token válido.',
        }),
        ApiResponse({
            status: 404,
            description: 'No encontrado. El área con el ID proporcionado no existe.',
        }),
        ApiResponse({
            status: 403,
            description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.',
        })
    );
}
/**
 * Decorador para documentar el endpoint de listado de áreas en Swagger.
 * @param Query - Parámetros de consulta para filtrar y paginar los resultados.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param optionalFilters - Filtros opcionales para la consulta, como estado de actividad.
 * @param pagination - Parámetros de paginación, como página y límite de resultados.
 * @returns - Un objeto con las áreas encontradas y metadatos de paginación.
 */
export function ApiSwaggerListarAreas() {
    return applyDecorators(
        ApiOperation({
            summary: 'Listar Áreas',
            description: 'Obtiene un listado de áreas con paginación y filtros opcionales. Requiere rol ADMIN o RRHH.',
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
            description: 'Cantidad de resultados por página.',
            required: false,
            type: Number,
            example: 50,
        }),
        ApiQuery({
            name: 'activo',
            description: 'Filtra por estado de actividad del área (true para activas, false para inactivas).',
            required: false,
            type: Boolean,
            example: true,
        }),
        ApiResponse({
            status: 200,
            description: 'Listado de áreas obtenido exitosamente.',
        }),
        ApiResponse({
            status: 401,
            description: 'No autorizado. El usuario no tiene un token válido.',
        }),
        ApiResponse({
            status: 403,
            description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.',
        })
    );
}
            