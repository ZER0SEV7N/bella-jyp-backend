//src/modules/RRHH/decorators/jordana-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiExtension
} from '@nestjs/swagger';

/**
 * Decorador personalizado para documentar los endpoints de Jordana en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerJordanaController() {
    return applyDecorators(ApiTags('Modulo RRHH - Jordana y Turnos'), ApiBearerAuth('JWT-auth'), ApiExtension('x-roles', ['ADMIN', 'RRHH']));
}

/**
 * Decorador para documentar el endpoint de creación de una jordana en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerCrearJordana() {
    return applyDecorators(
        ApiOperation({
            summary: 'Crear Jordana',
            description: 'Registra una nueva jordana o turno de trabajo en el sistema.',
        }),
        ApiBody({
            schema: {
                type: 'object',
                required: ['nombre', 'hora_entrada', 'hora_salida'],
                properties: {
                    nombre: { type: 'string', example: 'Jornada Matutina' },
                    hora_entrada: { type: 'string', example: '08:00' },
                    hora_salida: { type: 'string', example: '17:00' },
                    activo: { type: 'boolean', example: true },
                    tolerancia_minutos: { type: 'number', example: 15 },
                },
            },
        }),
        ApiResponse({
            status: 201,
            description: 'Jordana creada exitosamente.',
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
    );
}
/**
 * Decorador para documentar el endpoint de obtención de información de una jordana en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param id - ID de la jordana a obtener.
 */
export function ApiSwaggerListarJordana() {
    return applyDecorators(
        ApiOperation({
            summary: 'Listar Jordanas',
            description: 'Obtiene una lista de todas las jordanas o turnos de trabajo registrados en el sistema.',
        }),
        ApiExtension('x-roles', ['ADMIN', 'RRHH', 'CONTADOR']),
        ApiQuery({
            name: 'page',
            description: 'Número de página para la paginación.',
            required: false,
            schema: { type: 'number', default: 1 },
        }),
        ApiQuery({
            name: 'limit',
            description: 'Cantidad de elementos por página para la paginación.',
            required: false,
            schema: { type: 'number', default: 10 },
        }),
        ApiQuery({
            name: 'activo',
            description: 'Filtra las jordanas por estado activo o inactivo.',
            required: false,
            schema: { type: 'boolean' },
        }),
        ApiResponse({
            status: 200,
            description: 'Lista de jordanas obtenida exitosamente.',
        }),
        ApiResponse({
            status: 401,
            description: 'No autorizado. El usuario no tiene un token válido.',
        }),
        ApiResponse({
            status: 403,
            description: 'Prohibido. El usuario no tiene el rol necesario para realizar esta acción.',
        }),
    );
}

/**
 * Decorador para documentar el endpoint de actualización de una jordana en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param id - ID de la jordana a actualizar.
 */
export function ApiSwaggerActualizarJordana() {
    return applyDecorators(
        ApiOperation({
            summary: 'Actualizar Jordana',
            description: 'Actualiza la información de una jordana o turno de trabajo existente en el sistema.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID de la jordana a actualizar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiBody({
            schema: {
                type: 'object',
                properties: {
                    nombre: { type: 'string', example: 'Jornada Vespertina' },
                    hora_entrada: { type: 'string', example: '14:00' },
                    hora_salida: { type: 'string', example: '22:00' },
                    activo: { type: 'boolean', example: true },
                    tolerancia_minutos: { type: 'number', example: 10 },
                },
            },
        }),
        ApiResponse({
            status: 200,
            description: 'Jordana actualizada exitosamente.',
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
            status: 404,
            description: 'No encontrado. La jordana con el ID proporcionado no existe.',
        }),
    );
}
/**
 * Decorador para documentar el endpoint de eliminación de una jordana en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param id - ID de la jordana a eliminar.
 */
export function ApiSwaggerDesactivarJordana() {
    return applyDecorators(
        ApiOperation({
            summary: 'Desactivar Jordana',
            description: 'Desactiva una jordana o turno de trabajo existente en el sistema.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID de la jordana a desactivar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiResponse({
            status: 200,
            description: 'Jordana desactivada exitosamente.',
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
            status: 404,
            description: 'No encontrado. La jordana con el ID proporcionado no existe.',
        }),
    );
}

/**
 * Decorador para documentar el endpoint de reactivación de una jordana en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param id - ID de la jordana a reactivar.
 */
export function ApiSwaggerReactivarJordana() {
    return applyDecorators(
        ApiOperation({
            summary: 'Reactivar Jordana',
            description: 'Reactiva una jordana o turno de trabajo que se encuentra desactivada en el sistema.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID de la jordana a reactivar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiResponse({
            status: 200,
            description: 'Jordana reactivada exitosamente.',
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
            status: 404,
            description: 'No encontrado. La jordana con el ID proporcionado no existe.',
        }),
    );
}