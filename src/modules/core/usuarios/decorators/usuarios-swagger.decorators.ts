// src/modules/core/usuarios/decorators/usuarios-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';

/**
 * Decorador para agrupar operaciones del módulo de usuarios.
 */
export function ApiSwaggerUsuariosController() {
  return applyDecorators(ApiTags('Core - Usuarios'), ApiBearerAuth('JWT-auth'));
}

/**
 * Documentación del endpoint GET /api/v1/core/usuarios/me
 */
export function ApiSwaggerObtenerMiPerfil() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener información del perfil en sesión',
      description: `Devuelve los metadatos de identidad, credenciales y vínculo laboral del usuario conectado.
- **Fuente de Identidad**: Extrae el identificador de usuario (\`req.user.id\`) verificado por el \`JwtAccessGuard\`.
- **Uso en Frontend**: Permite poblar el store global (Zustand/Redux) para autorizaciones en la UI, menús laterales y renderizado condicional de componentes según rol.`,
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Perfil de usuario obtenido con éxito.',
      schema: {
        example: {
          id: 'c2eebc11-9c0b-4ef8-bb6d-6bb9bd380aaa',
          tipo_documento: 'DNI',
          nro_documento: '72345678',
          email: 'admin.planillas@empresa.com',
          rol: 'ADMIN',
          estado: 'ACTIVO',
          ultimo_acceso: '2026-09-24T18:30:00.000Z',
          empleado: {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            nombres: 'Daniel Enrique',
            apellidos: 'Singer Rojas',
            cargo: 'Arquitecto de Software',
            area: 'Tecnología de la Información',
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario autenticado ya no existe o fue dado de baja.',
    })
  );
}

export function ApiSwaggerListarUsuarios() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar cuentas de usuario',
      description: 'Permite listar las cuentas de usuario con filtros y paginación. Solo los usuarios con roles ADMIN o RRHH pueden acceder a este endpoint.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
      name: 'page',
      required: false,
      description: 'Número de página para la paginación (opcional)',
    }), 
    ApiParam({
      name: 'limit',
      required: false,
      description: 'Número de resultados por página para la paginación (opcional)',
    }),
    ApiParam({
      name: 'rol',
      required: false,
      description: 'Filtra los usuarios por rol (opcional)',
    }),
    ApiParam({
      name: 'activo',
      required: false,
      description: 'Filtra los usuarios por estado activo/inactivo (opcional)',
    }),
    ApiParam({
      name: 'search',
      required: false,
      description: 'Filtra los usuarios por búsqueda de texto en nombre, correo o documento (opcional)',
    }),
    ApiResponse({
      status: 200,
      description: 'Lista de usuarios obtenida con éxito.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 404,
      description: 'No se encontraron usuarios que coincidan con los filtros proporcionados.',
    })
  );
}

/**
 * Decorador para documentar el endpoint Patch /api/v1/core/usuarios/:id/estado
 * que permite cambiar el estado activo/inactivo de un usuario.
 */
export function ApiSwaggerCambiarEstado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cambiar el estado de un usuario',
      description: 'Permite cambiar el estado activo/inactivo de un usuario específico. Los roles ADMIN y RRHH pueden realizar esta acción.',
    }),
    ApiBearerAuth('JWT-auth'),
    //Colocar el Body en la documentación de Swagger
    ApiBody({
      description: 'El nuevo estado del usuario',
      required: true,
      schema: {
        type: 'object',
        properties: {
          activo: {
            type: 'boolean',
            description: 'El nuevo estado del usuario (true para activo, false para inactivo)',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Estado del usuario actualizado con éxito.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario no existe o fue dado de baja.',
    })
  );
}

export function ApiSwaggerCambiarRol() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cambiar el rol de un usuario',
      description: 'Permite cambiar el rol de un usuario específico. Solo los usuarios con rol ADMIN pueden realizar esta acción.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiBody({
      description: 'El nuevo rol del usuario',
      required: true,
      schema: {
        type: 'object',
        properties: {
          rol: {
            type: 'string',
            description: 'El nuevo rol del usuario',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Rol del usuario actualizado con éxito.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario no existe o fue dado de baja.',
    })
  );
}

export function ApiSwaggerCambiarMiPassword() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cambiar mi contraseña',
      description: 'Permite al usuario autenticado cambiar su propia contraseña. Se requiere la contraseña actual y la nueva contraseña.',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiBody({
      description: 'Contraseña actual y nueva contraseña',
      required: true,
      schema: {
        type: 'object',
        properties: {
          password_actual: {
            type: 'string',
            description: 'La contraseña actual del usuario',
          },
          nueva_password: {
            type: 'string',
            description: 'La nueva contraseña que el usuario desea establecer',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Contraseña actualizada con éxito.',
    }),
    ApiResponse({
      status: 400,
      description: 'La nueva contraseña no cumple con los requisitos de seguridad o es idéntica a la actual.',
    }),
    ApiResponse({
      status: 401,
      description: 'Token de acceso ausente, vencido o con firma no válida.',
    }),
    ApiResponse({
      status: 404,
      description: 'El usuario no existe o fue dado de baja.',
    })
  );
}