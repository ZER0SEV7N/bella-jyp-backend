//src/modules/core/usuarios/decorators/usuarios-swagger.decorators.ts
import {
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import { MiPerfilSchema } from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

/**
 * Decorador para agrupar operaciones del módulo de usuarios.
 */
export function ApiSwaggerUsuariosController() {
  return applyDecorators(ApiTags('Core - Usuarios'), ApiBearerAuth('JWT-auth'));
}

/**
 * Documentación del endpoint GET /api/v1/core/usuarios/me.
 */
export function ApiSwaggerObtenerMiPerfil() {
  return applyDecorators(
    ApiOperacionDocumentada({
      summary: 'Obtener información del perfil en sesión',
      description:
        'Devuelve la identidad, correo, rol, último acceso y vínculo laboral básico (nro_documento, nombre_completo, cargo, area) del usuario autenticado (`req.user.id`).',
      roles: [],
      respuesta: esquemaContrato(MiPerfilSchema),
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario autenticado ya no existe.',
    })
  );
}

/**
 * Documentación del endpoint GET /api/v1/core/usuarios.
 */
export function ApiSwaggerListarUsuarios() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      description:
        'Número de página en texto crudo (se convierte con Number; mínimo efectivo 1, por defecto 1).',
      schema: { type: 'string' },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description:
        'Resultados por página en texto crudo (se convierte con Number y se acota entre 1 y 100; por defecto 20).',
      schema: { type: 'string' },
    }),
    ApiQuery({
      name: 'rol',
      required: false,
      description:
        'Filtra las cuentas por rol en texto crudo, sin validación previa (un valor fuera del enum provoca error 500).',
      schema: { type: 'string' },
    }),
    ApiQuery({
      name: 'activo',
      required: false,
      description:
        "Filtra por estado activo en texto crudo: solo el texto exacto 'true' equivale a true; cualquier otro valor enviado equivale a false.",
      schema: { type: 'string' },
    }),
    ApiQuery({
      name: 'search',
      required: false,
      description:
        'Búsqueda por términos en correo, número de documento, nombre o apellido del colaborador.',
      schema: { type: 'string' },
    }),
    ApiOperacionDocumentada({
      summary: 'Listar cuentas de usuario',
      description:
        "Lista paginada de cuentas no eliminadas. Los parámetros de consulta se reciben como texto crudo sin ZodValidationPipe: un rol inválido no se valida y termina en error 500, y activo solo es true cuando coincide exactamente con el texto 'true' (cualquier otro texto filtra como false).",
      roles: ['ADMIN', 'RRHH'],
      paginada: true,
      respuesta: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            rol: {
              type: 'string',
              enum: ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE', 'EMPLEADO', 'JYP'],
            },
            activo: { type: 'boolean' },
            ultimo_acceso: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            created_at: { type: 'string', format: 'date-time' },
            empleados: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                nro_documento: { type: 'string' },
                nombre: { type: 'string' },
                apellido: { type: 'string' },
                estado_laboral: { type: 'string' },
                area: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nombre: { type: 'string' },
                  },
                },
                cargo: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nombre: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 403,
      description: 'El rol no tiene permisos para listar cuentas de usuario.',
    }),
    ApiResponse({
      status: 500,
      description:
        'Error interno si se envía un valor de rol inválido para el enum de Prisma.',
    })
  );
}

/**
 * Documentación del endpoint PATCH /api/v1/core/usuarios/:id/estado.
 */
export function ApiSwaggerCambiarEstado() {
  return applyDecorators(
    ApiIdentificador('id', true),
    ApiBody({
      description: 'Nuevo estado activo de la cuenta de usuario.',
      required: true,
      schema: {
        type: 'object',
        required: ['activo'],
        properties: {
          activo: {
            type: 'boolean',
            description:
              'Nuevo estado (true para activar, false para desactivar).',
          },
        },
      },
    }),
    ApiOperacionDocumentada({
      summary: 'Cambiar el estado de un usuario',
      description:
        'Activa o desactiva una cuenta respetando la jerarquía de privilegios (RRHH solo modifica ASISTENTE o EMPLEADO; nadie modifica JYP). Impide desactivar la propia cuenta o reactivar un colaborador inactivo/cesado (400), y al desactivar invalida todos sus tokens de sesión.',
      roles: ['ADMIN', 'RRHH'],
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string' },
          rol: { type: 'string' },
          activo: { type: 'boolean' },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'UUID inválido, intento de desactivar la propia cuenta o colaborador con vínculo inactivo.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 403,
      description: 'El rol del actor no permite modificar al usuario objetivo.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario no existe o fue eliminado.',
    })
  );
}

/**
 * Documentación del endpoint PATCH /api/v1/core/usuarios/:id/rol.
 */
export function ApiSwaggerCambiarRol() {
  return applyDecorators(
    ApiIdentificador('id', true),
    ApiBody({
      description: 'Nuevo rol a asignar al usuario.',
      required: true,
      schema: {
        type: 'object',
        required: ['rol'],
        properties: {
          rol: {
            type: 'string',
            enum: ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE', 'EMPLEADO'],
            description: 'Nuevo rol del usuario (no se permite asignar JYP).',
          },
        },
      },
    }),
    ApiOperacionDocumentada({
      summary: 'Cambiar el rol de un usuario',
      description:
        'Actualiza el rol de una cuenta (solo ADMIN; prohíbe modificar el propio rol y asignar o modificar cuentas JYP) e invalida todos los tokens activos del usuario objetivo.',
      roles: ['ADMIN'],
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string' },
          rol: { type: 'string' },
          activo: { type: 'boolean' },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Identificador UUID inválido.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 403,
      description:
        'Rol sin permiso, intento de cambiar el propio rol o jerarquía no permitida.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario no existe o fue eliminado.',
    })
  );
}

/**
 * Documentación del endpoint PATCH /api/v1/core/usuarios/me/password.
 */
export function ApiSwaggerCambiarMiPassword() {
  return applyDecorators(
    ApiBody({
      description:
        'Contraseña actual y nueva contraseña (mínimo 8 caracteres).',
      required: true,
      schema: {
        type: 'object',
        required: ['password_actual', 'nueva_password'],
        properties: {
          password_actual: {
            type: 'string',
            description: 'Contraseña actual del usuario autenticado.',
          },
          nueva_password: {
            type: 'string',
            minLength: 8,
            description:
              'Nueva contraseña (mínimo 8 caracteres y distinta a la actual).',
          },
        },
      },
    }),
    ApiOperacionDocumentada({
      summary: 'Cambiar mi contraseña',
      description:
        'Verifica la contraseña actual (401 si no coincide), exige al menos 8 caracteres y que sea distinta a la actual (400), actualiza el hash Argon2id e invalida todos los refresh tokens activos de la cuenta.',
      roles: [],
      respuesta: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Contraseña actualizada exitosamente.',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'La nueva contraseña tiene menos de 8 caracteres o es idéntica a la actual.',
    }),
    ApiResponse({
      status: 401,
      description:
        'Token de acceso inválido o la contraseña actual ingresada es incorrecta.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario no existe o está inactivo.',
    })
  );
}
