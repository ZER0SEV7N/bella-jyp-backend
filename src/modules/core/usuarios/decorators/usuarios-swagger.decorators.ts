// src/modules/core/usuarios/decorators/usuarios-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Decorador para agrupar operaciones del módulo de usuarios.
 */
export function ApiSwaggerUsuariosController() {
  return applyDecorators(
    ApiTags('Core - Usuarios'),
    ApiBearerAuth('JWT-auth'),
  );
}

/**
 * Documentación del endpoint GET /api/usuarios/me
 */
export function ApiSwaggerObtenerMiPerfil() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener información del perfil en sesión',
      description: `
Devuelve los metadatos de identidad, credenciales y vínculo laboral del usuario conectado.
- **Fuente de Identidad**: Extrae el identificador de usuario (\`req.user.id\`) verificado por el \`JwtAccessGuard\`.
- **Uso en Frontend**: Permite poblar el store global (Zustand/Redux) para autorizaciones en la UI, menús laterales y renderizado condicional de componentes según rol.`,
    }),
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
    }),
  );
}