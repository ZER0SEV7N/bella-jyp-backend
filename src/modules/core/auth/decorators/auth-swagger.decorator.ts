//src/modules/core/auth/decorators/auth.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

/**
 * Decorador personalizado para documentar los endpoints de autenticación en Swagger.
 * @param tag - Nombre de la etiqueta para agrupar los endpoints en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 */
export function ApiSwaggerController() {
  return applyDecorators(ApiTags('Modulo Autenticación'));
}

/**
 * Decorador personalizado para documentar el endpoint de login en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 * @param responseSchema - Esquema de validación para la respuesta.
 */
export function ApiSwaggerLogin() {
  return applyDecorators(
    ApiOperation({
      summary: 'Iniciar Sesion',
      description:
        'Valida credenciales. Devuelve un JWT en JSON y Refresh Token en Cookie.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['tipo_documento', 'nro_documento', 'password'],
        properties: {
          tipo_documento: { type: 'string', example: 'DNI' },
          nro_documento: { type: 'string', example: '12345678' },
          password: { type: 'string', example: 'password123' },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description:
        'Login exitoso. Devuelve Access Token en JSON y Refresh Token en Cookie.',
    }),
    ApiResponse({
      status: 401,
      description: 'Credenciales inválidas. Devuelve un mensaje de error.',
    }),
  );
}

/**
 * Decorador personalizado para documentar el endpoint de refrescar token en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param responseSchema - Esquema de validación para la respuesta.
 */
export function ApiSwaggerRefresh() {
  return applyDecorators(
    ApiOperation({
      summary: 'Refrescar Token',
      description:
        'Valida el Refresh Token en Cookie y devuelve un nuevo Access Token en JSON.',
    }),
    ApiResponse({
      status: 200,
      description:
        'Refresh Token válido. Devuelve un nuevo Access Token en JSON.',
    }),
    ApiResponse({
      status: 401,
      description:
        'Refresh Token inválido o expirado. Devuelve un mensaje de error.',
    }),
  );
}

/**
 * Decorador personalizado para documentar el endpoint de provisionar usuario en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 */
export function ApiSwaggerProvisionar() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Provisionar Usuario',
      description:
        'Crea un nuevo usuario interno. Solo accesible para roles ADMIN o RRHH.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['tipo_documento', 'nro_documento', 'password', 'rol'],
        properties: {
          tipo_documento: { type: 'string', example: 'DNI' },
          nro_documento: { type: 'string', example: '12345678' },
          password: { type: 'string', example: 'password123' },
          email: { type: 'string', example: 'user@example.com' },
          rol: { type: 'string', example: 'ADMIN' },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description:
        'Usuario creado exitosamente. Devuelve el ID y rol del nuevo usuario.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos. Devuelve un mensaje de error.',
    }),
    ApiResponse({
      status: 403,
      description:
        'Acceso denegado. El usuario no tiene permisos para provisionar usuarios.',
    }),
  );
}
/**
 * Decorador personalizado para documentar el endpoint de recuperación de contraseña en Swagger.
 * @param summary - Resumen de la operación para mostrar en Swagger.
 * @param requestBodySchema - Esquema de validación para el cuerpo de la solicitud.
 * @param responseSchema - Esquema de validación para la respuesta.
 */
export function ApiSwaggerRecuperarPassword() {
  return applyDecorators(
    ApiOperation({
      summary: 'Recuperar Contraseña',
      description:
        'Solicita la recuperación de contraseña enviando un correo con un enlace de restablecimiento.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          nro_documento: { type: 'string', example: '12345678' },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description:
        'Solicitud de recuperación de contraseña enviada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos. Devuelve un mensaje de error.',
    }),
  );
}
