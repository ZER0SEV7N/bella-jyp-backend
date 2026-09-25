// src/modules/core/auth/decorators/auth.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';

export function ApiSwaggerController() {
  return applyDecorators(ApiTags('Core - Autenticación'));
}

export function ApiSwaggerLogin() {
  return applyDecorators(
    ApiOperation({
      summary: 'Iniciar Sesión (Estrategia Dual Token)',
      description: `Valida credenciales contra hash Argon2id y establece la sesión:
1. Emite un **Access Token** (JWT de 15 min) en el cuerpo JSON para uso en memoria.
2. Inyecta un **Refresh Token** (7 días) en una cookie \`HttpOnly\`, protegida contra ataques XSS.
3. Registra el token hash en Redis para permitir revocación centralizada.`,
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['tipo_documento', 'nro_documento', 'password'],
        properties: {
          tipo_documento: { type: 'string', example: 'DNI' },
          nro_documento: { type: 'string', example: '72345678' },
          password: { type: 'string', format: 'password', example: 'Admin2026*' },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Login exitoso. Devuelve Access Token en JSON y configura cookie HttpOnly con Refresh Token.',
      headers: {
        'Set-Cookie': {
          description: 'refreshToken=eyJhbG...; Path=/api/auth; HttpOnly; Secure; SameSite=Strict',
          schema: { type: 'string' },
        },
      },
      schema: {
        example: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          expires_in: 900,
          usuario: {
            id: 'c2eebc11-9c0b-4ef8-bb6d-6bb9bd380aaa',
            rol: 'ADMIN',
            nombres: 'Daniel Singer',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Credenciales inválidas o cuenta de usuario inactiva.',
    }),
  );
}

export function ApiSwaggerRefresh() {
  return applyDecorators(
    ApiCookieAuth('refreshToken'),
    ApiOperation({
      summary: 'Refrescar Access Token',
      description: `Genera un nuevo Access Token sin requerir que el usuario vuelva a ingresar su contraseña:
- Lee automáticamente la cookie segura \`refreshToken\`.
- Valida la firma del token y comprueba en Redis que la sesión no haya sido revocada.
- Retorna un nuevo JWT para reactivar las llamadas a la API.`,
    }),
    ApiResponse({
      status: 200,
      description: 'Token refrescado exitosamente.',
      schema: {
        example: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.nuevoToken...',
          expires_in: 900,
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Cookie ausente, token revocado en Redis o expirado.',
    }),
  );
}

export function ApiSwaggerLogout() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiCookieAuth('refreshToken'),
    ApiOperation({
      summary: 'Cerrar Sesión e Invalidar Tokens',
      description: `Finaliza de forma determinista la sesión del usuario:
1. Elimina la clave de sesión en Redis vinculada al usuario autenticado.
2. Limpia la cookie del navegador seteando \`Max-Age=0\`.
3. Cualquier intento posterior de usar el Refresh Token expirará con 401 Unauthorized.`,
    }),
    ApiResponse({
      status: 200,
      description: 'Sesión cerrada con éxito y cookie eliminada.',
      schema: {
        example: {
          success: true,
          message: 'Sesión cerrada exitosamente.',
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso no válido o sesión ya expirada.',
    }),
  );
}

export function ApiSwaggerProvisionar() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Provisionar Usuario Interno',
      description: 'Crea credenciales iniciales para un nuevo trabajador. Exclusivo para ADMIN o RRHH.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['tipo_documento', 'nro_documento', 'password', 'rol'],
        properties: {
          tipo_documento: { type: 'string', example: 'DNI' },
          nro_documento: { type: 'string', example: '72345678' },
          password: { type: 'string', example: 'UsuarioInicial2026*' },
          email: { type: 'string', format: 'email', example: 'operador@empresa.com' },
          rol: { type: 'string', enum: ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'], example: 'ASISTENTE' },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Usuario provisionado con éxito en PostgreSQL con hash Argon2id.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos o documento duplicado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Acceso denegado: Se requiere rol ADMIN o RRHH.',
    }),
  );
}

export function ApiSwaggerRecuperarPassword() {
  return applyDecorators(
    ApiOperation({
      summary: 'Solicitar Recuperación de Contraseña',
      description: 'Genera un token efímero firmado y remite un enlace de recuperación al correo registrado.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['nro_documento'],
        properties: {
          nro_documento: { type: 'string', example: '72345678' },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Solicitud procesada (retorna 200 genérico para prevenir enumeración de usuarios).',
    }),
    ApiResponse({
      status: 400,
      description: 'Documento con formato inválido.',
    }),
  );
}