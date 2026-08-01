//src/modules/RRHH/decorators/empleado-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

/**
 * Decorador personalizado para documentar los endpoints de empleados en Swagger.
 * @param tag - Nombre de la etiqueta para agrupar los endpoints en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerEmpleadosController() {
    return applyDecorators(ApiTags('Modulo RRHH - Empleados'), ApiBearerAuth('JWT-auth'));
}

/**
 * Decorador para documentar el endpoint de creación de un empleado en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerCrearEmpleado() {
    return applyDecorators(
        ApiOperation({
            summary: 'Crear Empleado',
            description:
            'Crea un nuevo legajo. Si no se envía nombre y apellido (y es DNI), el sistema consultará a RENIEC. Requiere rol ADMIN o RRHH.',
        }),
        ApiBody({
            schema: {
                type: 'object',
                required: [
                    'cargo_id',
                    'area_id',
                    'documento_id',
                    'estado_empleado_id',
                    'nro_documento',
                ],
                properties: {
                    cargo_id: { type: 'string', format: 'uuid' },
                    area_id: { type: 'string', format: 'uuid' },
                    documento_id: { type: 'string', format: 'uuid' },
                    estado_empleado_id: { type: 'string', format: 'uuid' },
                    nro_documento: { type: 'string', example: '70112233' },
                    nombre: { type: 'string', nullable: true },
                    apellido: { type: 'string', nullable: true },
                    asig_familiar: { type: 'boolean', default: false },
                },
            },
        }),
        ApiResponse({
            status: 201,
            description: 'Empleado creado exitosamente.',
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
 * Decorador para documentar el endpoint de actualización de un empleado en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del empleado a actualizar.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerActualizarEmpleado() {
    return applyDecorators(
        ApiOperation({
            summary: 'Actualizar Empleado',
            description: 'Actualiza los detalles de un empleado existente. Requiere rol ADMIN o RRHH.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID del empleado a actualizar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiBody({
            schema: {
                type: 'object',
                properties: {
                    cargo_id: { type: 'string', format: 'uuid' },
                    area_id: { type: 'string', format: 'uuid' },
                    documento_id: { type: 'string', format: 'uuid' },
                    estado_empleado_id: { type: 'string', format: 'uuid' },
                    nro_documento: { type: 'string', example: '70112233' },
                    nombre: { type: 'string', nullable: true },
                    apellido: { type: 'string', nullable: true },
                    asig_familiar: { type: 'boolean', default: false },
                },
            },
        }),
        ApiResponse({
            status: 200,
            description: 'Empleado actualizado exitosamente.',
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
        }),
        ApiResponse({
            status: 404,
            description: 'No encontrado. El empleado con el ID proporcionado no existe.',
        })
    );
}
/**
 * Decorador para documentar el endpoint de eliminación de un empleado en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del empleado a eliminar.
 */
export function ApiSwaggerDesactivarEmpleado() {
    return applyDecorators(
        ApiOperation({
            summary: 'Desactivar Empleado',
            description: 'Desactiva un empleado existente.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID del empleado a desactivar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiResponse({
            status: 200,
            description: 'Empleado desactivado exitosamente.',
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
            description: 'No encontrado. El empleado con el ID proporcionado no existe.',
        })
    );
}
/**
 * Decorador para documentar el endpoint de reactivación de un empleado en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param idParam - Parámetro de ruta que representa el ID del empleado a reactivar.
 */
export function ApiSwaggerReactivarEmpleado() {
    return applyDecorators(
        ApiOperation({
            summary: 'Reactivar Empleado',
            description: 'Reactiva un empleado que se encuentra desactivado.',
        }),
        ApiParam({
            name: 'id',
            description: 'ID del empleado a reactivar (UUID).',
            required: true,
            schema: { type: 'string', format: 'uuid' },
        }),
        ApiResponse({
            status: 200,
            description: 'Empleado reactivado exitosamente.',
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
            description: 'No encontrado. El empleado con el ID proporcionado no existe.',
        })
    );
}
/**
 * Decorador para documentar el endpoint de listado de empleados en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param queryParams - Parámetros de consulta para filtrar y paginar los resultados.
 * @returns - Decorador para documentar el endpoint de listado de empleados en Swagger.
 */
export function ApiSwaggerListarEmpleados() {
    return applyDecorators(
        ApiOperation({ 
            summary: 'Listar Empleados', 
            description: 'Obtiene el maestro de empleados.' 
        }),
        ApiQuery({ 
            name: 'page', 
            description: 'Número de página para la paginación.',
            required: false, 
            type: Number, 
            example: 1 
        }),
        ApiQuery({ 
            name: 'limit', 
            description: 'Límite de resultados por página.',
            required: false, 
            type: Number, 
            example: 50 
        }),
        ApiQuery({ 
            name: 'area_id', 
            description: 'ID del área para filtrar los empleados.',
            required: false, 
            type: 'string', 
            format: 'uuid' 
        }),
        ApiQuery({ 
            name: 'cargo_id', 
            description: 'ID del cargo para filtrar los empleados.',
            required: false, 
            type: 'string', 
            format: 'uuid' 
        }),
        ApiQuery({ 
            name: 'activo', 
            description: 'Estado de actividad del empleado.',
            required: false, 
            type: Boolean 
        }),
        ApiResponse({
            status: 200,
            description: 'Listado de empleados obtenido exitosamente.',
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