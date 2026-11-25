//src/modules/core/auth/decorators/auth-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiOperacionDocumentada,
} from '@/common/decorators/api-contrato.decorator';
import {
  LoginSchema,
  ProvisionarUsuarioSchema,
  RestablecerPasswordSchema,
  SolicitudRecuperacionSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

export function ApiSwaggerController() {
  return applyDecorators(ApiTags('Core - Autenticación'));
}

export function ApiSwaggerLogin() {
  return applyDecorators(
    ApiContratoBody(LoginSchema),
    ApiOperacionDocumentada({
      summary: 'Iniciar sesión (estrategia dual token)',
      description:
        'Valida documento y contraseña contra Argon2id, aplica límite de intentos por documento e IP (429) y registra ultimo_acceso. Devuelve accessToken (15 min) y datos del usuario en JSON, guarda el refresh token (7 días) en PostgreSQL y envía la cookie HttpOnly `jyp_rt` (`Path=/`, `SameSite=Lax`).',
      roles: [],
      status: 200,
      respuesta: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          usuario: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              nombre: { type: 'string' },
              email: { type: 'string' },
              nro_documento: { type: 'string', nullable: true },
              rol: { type: 'string' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Credenciales con formato inválido según contrato Zod.',
    }),
    ApiResponse({
      status: 401,
      description: 'Documento o contraseña incorrectos, o cuenta inactiva.',
    }),
    ApiResponse({
      status: 429,
      description: 'Demasiados intentos de inicio de sesión.',
    })
  );
}

export function ApiSwaggerRefresh() {
  return applyDecorators(
    ApiCookieAuth('jyp_rt'),
    ApiOperacionDocumentada({
      summary: 'Refrescar Access Token',
      description:
        'Lee la cookie HttpOnly `jyp_rt`, verifica la firma JWT y que el token siga vigente y sin usar en PostgreSQL, rota el refresh token (marca el anterior como usado y actualiza `jyp_rt`) y devuelve un nuevo accessToken.',
      roles: [],
      status: 200,
      respuesta: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description:
        'Cookie `jyp_rt` ausente, usuario inactivo, token expirado, revocado o ya utilizado.',
    })
  );
}

export function ApiSwaggerLogout() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiCookieAuth('jyp_rt'),
    ApiOperacionDocumentada({
      summary: 'Cerrar sesión e invalidar tokens',
      description:
        'Marca como usado el refresh token de la cookie `jyp_rt` en PostgreSQL, agrega el access token Bearer a la lista negra en Redis por su TTL restante y limpia la cookie `jyp_rt` (`Max-Age=0`).',
      roles: [],
      status: 200,
      respuesta: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Sesión Finalizada' },
          detail: {
            type: 'string',
            example: 'Tokens invalidados exitosamente.',
          },
        },
      },
    })
  );
}

export function ApiSwaggerProvisionar() {
  return applyDecorators(
    ApiContratoBody(ProvisionarUsuarioSchema),
    ApiOperacionDocumentada({
      summary: 'Provisionar usuario interno',
      description:
        'Crea credenciales en PostgreSQL con hash Argon2id para un colaborador activo existente. Exige un Access Token válido y respeta la jerarquía de roles (AUTH-F1): JYP y ADMIN pueden crear ADMIN, RRHH, CONTADOR, ASISTENTE y EMPLEADO; RRHH solo puede crear ASISTENTE y EMPLEADO. Exige correo corporativo (400), rechaza crear una cuenta destino con rol JYP (403), valida que el colaborador exista y esté activo (404) y que no tenga usuario previo (409).',
      roles: ['JYP', 'ADMIN', 'RRHH'],
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          rol: { type: 'string' },
          nro_documento: { type: 'string', nullable: true },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos o falta el correo corporativo obligatorio.',
    }),
    ApiResponse({
      status: 401,
      description: 'Falta el Access Token o la sesión fue revocada.',
    }),
    ApiResponse({
      status: 403,
      description:
        'La cuenta destino solicita un rol que el actor no puede asignar (incluye el rol JYP, reservado a administración del software).',
    }),
    ApiResponse({
      status: 404,
      description: 'El colaborador no existe, fue eliminado o está inactivo.',
    }),
    ApiResponse({
      status: 409,
      description:
        'El colaborador ya posee credenciales de acceso registradas.',
    })
  );
}

export function ApiSwaggerRecuperarPassword() {
  return applyDecorators(
    ApiContratoBody(SolicitudRecuperacionSchema),
    ApiOperacionDocumentada({
      summary: 'Solicitar recuperación de contraseña',
      description:
        'Aplica control de intentos por documento e IP (429), genera un token de 15 minutos en PostgreSQL invalidando solicitudes previas y encola el envío por n8n si el usuario activo tiene correo. Responde de forma uniforme para evitar enumeración de usuarios.',
      roles: [],
      status: 200,
      respuesta: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example:
              'Si el documento es válido, se enviarán las instrucciones.',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Número de documento con formato inválido.',
    }),
    ApiResponse({
      status: 429,
      description: 'Demasiadas solicitudes de recuperación.',
    }),
    ApiResponse({
      status: 503,
      description:
        'La recuperación por correo no está configurada en el entorno.',
    })
  );
}

export function ApiSwaggerRestablecerPassword() {
  return applyDecorators(
    ApiContratoBody(RestablecerPasswordSchema),
    ApiOperacionDocumentada({
      summary: 'Restablecer contraseña',
      description:
        'Aplica control de intentos por IP (429), verifica el token compuesto (15 min, un solo uso), exige una contraseña distinta a la actual (mínimo 12 caracteres), actualiza el hash Argon2id e invalida todos los refresh tokens activos del usuario.',
      roles: [],
      status: 200,
      respuesta: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Contraseña actualizada correctamente.',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'Token inválido, expirado o usado, o contraseña igual a la anterior / fuera de contrato.',
    }),
    ApiResponse({
      status: 429,
      description: 'Demasiados intentos de restablecimiento.',
    })
  );
}
