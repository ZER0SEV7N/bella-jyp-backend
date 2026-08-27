//src/modules/RRHH/organizacion/decorators/jordana-swagger.decorator.ts
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
 * Decorador para documentar el controlador de Jornadas en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerJornadaController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Jornadas y Horarios Laborales'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH'])
  );
}

/**
 * Decorador para documentar el endpoint de creación de una jornada/turno en Swagger.
 */
export function ApiSwaggerCrearJornada() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Jornada / Turno',
      description: 'Registra una nueva jornada o turno laboral en el sistema, definiendo horas de entrada/salida y tolerancia.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['nombre', 'hora_entrada', 'hora_salida'],
        properties: {
          nombre: {
            type: 'string',
            example: 'Turno Mañana (Oficina Central)',
            description: 'Nombre descriptivo de la jornada'
          },
          tipo_jornada: {
            type: 'string',
            enum: ['FIJA', 'ROTATIVA', 'FLEXIBLE', 'PART_TIME'],
            default: 'FIJA',
            example: 'FIJA',
            description: 'Modalidad de la jornada laboral'
          },
          hora_entrada: {
            type: 'string',
            example: '08:00',
            description: 'Hora de inicio de la jornada (HH:mm o HH:mm:ss)'
          },
          hora_salida: {
            type: 'string',
            example: '17:00',
            description: 'Hora de finalización de la jornada (HH:mm o HH:mm:ss)'
          },
          tolerancia_minutos: {
            type: 'number',
            example: 15,
            default: 0,
            description: 'Minutos de tolerancia antes de computar tardanza'
          },
          activo: {
            type: 'boolean',
            default: true,
            example: true
          }
        }
      }
    }),
    ApiResponse({
      status: 201,
      description: 'Jornada creada exitosamente.'
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos o nombre de jornada duplicado.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT ausente o expirado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Se requieren permisos de ADMIN o RRHH.'
    }),
  );
}

/**
 * Decorador para documentar el endpoint de consulta paginada de jornadas en Swagger.
 */
export function ApiSwaggerListarJornada() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar Jornadas y Turnos',
      description: 'Obtiene una lista paginada de las jornadas laborales registradas con filtros por estado y modalidad.',
    }),
    ApiExtension('x-roles', ['ADMIN', 'RRHH', 'CONTADOR']),
    ApiQuery({
      name: 'page',
      description: 'Número de página para la paginación.',
      required: false,
      schema: { type: 'number', default: 1 }
    }),
    ApiQuery({
      name: 'limit',
      description: 'Cantidad de elementos por página.',
      required: false,
      schema: { type: 'number', default: 50 }
    }),
    ApiQuery({
      name: 'activo',
      description: 'Filtra las jornadas por estado activo o inactivo.',
      required: false,
      schema: { type: 'boolean' }
    }),
    ApiQuery({
      name: 'tipo_jornada',
      description: 'Filtra por modalidad de jornada.',
      required: false,
      enum: ['FIJA', 'ROTATIVA', 'FLEXIBLE', 'PART_TIME']
    }),
    ApiResponse({
      status: 200,
      description: 'Lista de jornadas obtenida exitosamente.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT inválido.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El rol autenticado no posee privilegios de consulta.'
    })
  );
}

/**
 * Decorador para documentar el endpoint de actualización de una jornada en Swagger.
 */
export function ApiSwaggerActualizarJornada() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar Jornada',
      description:'Actualiza los parámetros y horarios de una jornada existente identificada por su UUID.',
    }),
    ApiParam({
      name: 'id',
      description: 'ID único de la jornada a actualizar (UUIDv7).',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string', example: 'Turno Noche (Seguridad)' },
          tipo_jornada: {
            type: 'string',
            enum: ['FIJA', 'ROTATIVA', 'FLEXIBLE', 'PART_TIME'],
            example: 'ROTATIVA'
          },
          hora_entrada: { type: 'string', example: '19:00' },
          hora_salida: { type: 'string', example: '07:00' },
          tolerancia_minutos: { type: 'number', example: 10 },
          activo: { type: 'boolean', example: true },
        }
      }
    }),
    ApiResponse({
      status: 200,
      description: 'Jornada actualizada exitosamente.'
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos o nombre duplicado en otra jornada.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Permisos insuficientes.'
    }),
    ApiResponse({
      status: 404,
      description: 'Jornada no encontrada o previamente eliminada.'
    }),
  );
}

/**
 * Decorador para documentar la desactivación lógica (Soft Delete) de una jornada.
 */
export function ApiSwaggerDesactivarJornada() {
  return applyDecorators(
    ApiOperation({
      summary: 'Desactivar Jornada (Baja Lógica)',
      description:'Desactiva una jornada laboral del catálogo. Bloquea la acción si existen colaboradores activos asignados a ella.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la jornada a desactivar.',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }),
    ApiResponse({
      status: 200,
      description: 'Jornada desactivada exitosamente.'
    }),
    ApiResponse({
      status: 400,
      description: 'Operación bloqueada. Existen colaboradores activos usando este turno.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.'
    }),
    ApiResponse({
      status: 404,
      description: 'Jornada no encontrada o ya desactivada.'
    }),
  );
}

/**
 * Decorador para documentar la reactivación de una jornada previamente desactivada.
 */
export function ApiSwaggerReactivarJornada() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reactivar Jornada',
      description: 'Reactiva una jornada laboral desactivada previamente en el sistema.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la jornada a reactivar.',
      required: true,
      schema: { type: 'string', format: 'uuid' }
    }),
    ApiResponse({
      status: 200,
      description: 'Jornada reactivada exitosamente.'
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.'
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.'
    }),
    ApiResponse({
      status: 404,
      description: 'Jornada no encontrada.'
    }),
  );
}

// Aliases de retrocompatibilidad para evitar roturas de importación
export const ApiSwaggerJordanaController = ApiSwaggerJornadaController;
export const ApiSwaggerCrearJordana = ApiSwaggerCrearJornada;
export const ApiSwaggerListarJordana = ApiSwaggerListarJornada;
export const ApiSwaggerActualizarJordana = ApiSwaggerActualizarJornada;
export const ApiSwaggerDesactivarJordana = ApiSwaggerDesactivarJornada;
export const ApiSwaggerReactivarJordana = ApiSwaggerReactivarJornada;