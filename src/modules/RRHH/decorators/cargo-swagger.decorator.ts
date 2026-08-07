//src/modules/RRHH/decorators/cargo-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiExtension,
} from '@nestjs/swagger';

/**
 * Decorador personalizado para documentar los endpoints de cargos en Swagger.
 * @param tag - Nombre de la etiqueta para agrupar los endpoints en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerCargosController() {
  return applyDecorators(
    ApiTags('Modulo RRHH - Cargos'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH']),
  );
}
/**
 * Decorador para documentar el endopoint de creación de un cargo en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerCrearCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Cargo',
      description:
        'Registra un nuevo cargo o puesto de trabajo en el sistema. Requiere rol ADMIN o RRHH.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['id_area', 'nombre'],
        properties: {
          id_area: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          nombre: { type: 'string', example: 'Gerente de Ventas' },
          descripcion: {
            type: 'string',
            example:
              'Responsable de liderar el equipo de ventas y alcanzar los objetivos comerciales.',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Cargo creado exitosamente.',
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
 * Decorador para documentar el endopoint de actualización de un cargo en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del cargo a actualizar.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerActualizarCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar Cargo',
      description:
        'Actualiza los detalles de un cargo existente en el sistema. Requiere rol ADMIN o RRHH.',
    }),
    ApiParam({
      name: 'id',
      description: 'ID del cargo a actualizar (UUID).',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['id_area', 'nombre'],
        properties: {
          id_area: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          nombre: { type: 'string', example: 'Gerente de Ventas' },
          descripcion: {
            type: 'string',
            example:
              'Responsable de liderar el equipo de ventas y alcanzar los objetivos comerciales.',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Cargo actualizado exitosamente.',
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
    ApiResponse({
      status: 404,
      description: 'No encontrado. El cargo con el ID proporcionado no existe.',
    }),
  );
}
/**
 * Decorador para documentar el endopoint de eliminación de un cargo en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del cargo a eliminar.
 */
export function ApiSwaggerDesactivarCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Desactivar Cargo',
      description:
        'Desactiva un cargo existente en el sistema. Requiere rol ADMIN o RRHH.',
    }),
    ApiParam({
      name: 'id',
      description: 'ID del cargo a desactivar (UUID).',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiResponse({
      status: 200,
      description: 'Cargo desactivado exitosamente.',
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
    ApiResponse({
      status: 404,
      description: 'No encontrado. El cargo con el ID proporcionado no existe.',
    }),
  );
}

/**
 * Decorador para documentar el endopoint de reactivación de un cargo en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del cargo a reactivar.
 */
export function ApiSwaggerReactivarCargo() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reactivar Cargo',
      description:
        'Reactiva un cargo previamente desactivado en el sistema. Requiere rol ADMIN o RRHH.',
    }),
    ApiParam({
      name: 'id',
      description: 'ID del cargo a reactivar (UUID).',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiResponse({
      status: 200,
      description: 'Cargo reactivado exitosamente.',
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
    ApiResponse({
      status: 404,
      description: 'No encontrado. El cargo con el ID proporcionado no existe.',
    }),
  );
}
/**
 * Decorador para documentar el endpoint de listado de cargos en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param queryParams - Parámetros de consulta para filtrar y paginar los resultados.
 * @param optionalFilters - Filtros opcionales para la consulta, como estado de actividad.
 * @param pagination - Parámetros de paginación, como página y límite de resultados.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 * @returns - Un objeto con los cargos encontrados y metadatos de paginación.
 */
export function ApiSwaggerListarCargos() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar Cargos',
      description: 'Obtiene el listado de cargos con filtros opcionales.',
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
      description: 'Límite de resultados por página.',
      required: false,
      type: Number,
      example: 50,
    }),
    ApiQuery({
      name: 'id_area',
      description: 'ID del área para filtrar los resultados.',
      required: false,
      type: 'string',
      format: 'uuid',
    }),
    ApiQuery({
      name: 'activo',
      description: 'Estado de actividad del cargo.',
      required: false,
      type: Boolean,
    }),
    ApiResponse({
      status: 200,
      description: 'Listado de cargos obtenido exitosamente.',
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
