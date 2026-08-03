//src/modules/RRHH/decorators/empleado-bulk-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBody,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiParam,
    ApiExtension,
} from '@nestjs/swagger';

/**
 * Decorador personalizado para documentar los endpoints de empleados en masa en Swagger.
 * @param tag - Nombre de la etiqueta para agrupar los endpoints en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerEmpleadosBulkController() {
    return applyDecorators(ApiTags('Modulo RRHH - Carga Masiva CSVCarga Masiva CSV'), ApiBearerAuth('JWT-auth'), ApiExtension('x-roles', ['ADMIN', 'RRHH']));
}

/** 
 * Decorador para documentar el endpoint de carga masiva de empleados en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 * @returns Un objeto con el jobId para consultar el estado del procesamiento.
*/
export function ApiSwaggerUploadBulk() {
    return applyDecorators(
        ApiOperation({
            summary: 'Subir archivo CSV para carga masiva de empleados',
            description: 'Permite subir un archivo CSV para procesar la carga masiva de empleados. Requiere rol ADMIN o RRHH.',
        }),
        ApiConsumes('multipart/form-data'),
        ApiBody({
            schema: {
                type: 'object',
                properties: {
                    file: {
                        type: 'string',
                        format: 'binary',
                        description: 'Archivo CSV que contiene los datos de los empleados a cargar.',
                    },
                },
            },
        }),
        ApiResponse({
            status: 202,
            description: 'Archivo recibido y procesamiento iniciado. Retorna un jobId para consultar el estado del procesamiento.',
        }),
        ApiResponse({
            status: 400,
            description: 'Solicitud inválida. Devuelve un mensaje de error si el archivo no es válido o no se encuentra.',
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
 * Decorador para documentar el endpoint de consulta del estado de la carga masiva de empleados en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 * @returns Un objeto con el estado del procesamiento del jobId proporcionado.
 */
export function ApiSwaggerGetBulkStatus() {
    return applyDecorators(
        ApiOperation({
            summary: 'Consultar estado de procesamiento de carga masiva de empleados',
            description: 'Permite consultar el estado del procesamiento de un jobId generado al subir un archivo CSV para carga masiva de empleados. Requiere rol ADMIN o RRHH.',
        }),
        ApiParam({
            name: 'jobId',
            description: 'ID del job de carga masiva que se desea consultar.',
            required: true,
            schema: { type: 'string' },
        }),
        ApiResponse({
            status: 200,
            description: 'Retorna el estado actual del job, incluyendo total de registros, procesados y fallidos.',
        }),
        ApiResponse({
            status: 400,
            description: 'Solicitud inválida. Devuelve un mensaje de error si el jobId no es válido o no se encuentra.',
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
    