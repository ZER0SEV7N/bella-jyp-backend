//src/modules/RRHH/organizacion/decorators/jordana-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiExtension } from '@nestjs/swagger';

/**
 * Decorador para documentar el controlador de Jornadas en Swagger.
 * @requires - JWT Bearer token para autenticación.
 * @requires - Roles: ADMIN, RRHH para autorización.
 */
export function ApiSwaggerJornadaController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Jornadas y Horarios Laborales'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH']),
  );
}

/**
 * Decorador para documentar el endpoint de creación de una jornada/turno en Swagger.
 */
export function ApiSwaggerCrearJornada() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Jornada / Turno',
      description:
        'Registra una nueva jornada laboral definiendo duración, turno, modalidad general, áreas aplicables, la grilla semanal completa (con refrigerios) y el patrón de rotación si corresponde.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: [
          'nombre',
          'duracion',
          'turno',
          'modalidad',
          'areas_ids',
          'horario_semanal'
        ],
        properties: {
          nombre: {
            type: 'string',
            example: 'Jornada Estándar Oficina',
            description: 'Nombre identificativo de la jornada',
          },
          descripcion: {
            type: 'string',
            example: 'Horario administrativo de 40h semanales de Lunes a Viernes',
            description: 'Detalle o notas sobre la jornada',
          },
          duracion: {
            type: 'string',
            enum: ['TIEMPO_COMPLETO', 'TIEMPO_PARCIAL'],
            default: 'TIEMPO_COMPLETO',
            example: 'TIEMPO_COMPLETO',
          },
          turno: {
            type: 'string',
            enum: ['MANANA', 'TARDE', 'NOCHE', 'MIXTO', 'ROTATIVO'],
            default: 'MANANA',
            example: 'MANANA',
          },
          modalidad: {
            type: 'string',
            enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'],
            default: 'PRESENCIAL',
            example: 'PRESENCIAL',
          },
          tolerancia_minutos: {
            type: 'number',
            example: 10,
            default: 5,
            description: 'Minutos de gracia al ingreso antes de computar tardanza',
          },
          areas_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            example: ['018f4a7c-7777-7000-1111-000000000001'],
            description: 'IDs de las áreas habilitadas para utilizar este turno',
          },
          horario_semanal: {
            type: 'array',
            description: 'Configuración detallada de los 7 días de la semana',
            items: {
              type: 'object',
              properties: {
                dia: {
                  type: 'string',
                  enum: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'],
                  example: 'LUNES',
                },
                laborable: { type: 'boolean', example: true },
                modalidad: { type: 'string', enum: ['PRESENCIAL', 'REMOTO'], example: 'PRESENCIAL' },
                entrada: { type: 'string', example: '08:00' },
                inicio_descanso: { type: 'string', example: '13:00' },
                fin_descanso: { type: 'string', example: '14:00' },
                salida: { type: 'string', example: '17:00' },
              },
            },
          },
          patron_rotacion: {
            type: 'object',
            description: 'Parámetros del ciclo rotativo (obligatorio si turno == ROTATIVO)',
            properties: {
              tipo_ciclo: { type: 'string', example: '6x1' },
              dias_trabajo: { type: 'number', example: 6 },
              dias_descanso: { type: 'number', example: 1 },
              frecuencia_cambio: {
                type: 'string',
                enum: ['SEMANAL', 'QUINCENAL', 'MENSUAL'],
                example: 'SEMANAL',
              },
              turnos_base: {
                type: 'array',
                items: { type: 'string' },
                example: ['MANANA', 'TARDE'],
              },
            },
          },
          activo: { type: 'boolean', default: true, example: true },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Jornada creada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos, nombre duplicado o excede 48 horas semanales.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT ausente o expirado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Se requieren privilegios de ADMIN o RRHH.',
    }),
    ApiResponse({
      status: 404,
      description: 'Una o más áreas seleccionadas no existen o están inactivas.',
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
      description:
        'Obtiene una lista paginada de las jornadas laborales registradas con filtros avanzados por estado, modalidad, turno, duración o área.',
    }),
    ApiExtension('x-roles', ['ADMIN', 'RRHH', 'CONTADOR']),
    ApiQuery({
      name: 'page',
      description: 'Número de página.',
      required: false,
      schema: { type: 'number', default: 1 },
    }),
    ApiQuery({
      name: 'limit',
      description: 'Cantidad de elementos por página.',
      required: false,
      schema: { type: 'number', default: 10 },
    }),
    ApiQuery({
      name: 'search',
      description: 'Búsqueda por coincidencia en nombre o descripción.',
      required: false,
      schema: { type: 'string' },
    }),
    ApiQuery({
      name: 'area_id',
      description: 'Filtra jornadas aplicables a un área específica.',
      required: false,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiQuery({
      name: 'turno',
      description: 'Filtra por tipo de turno.',
      required: false,
      enum: ['MANANA', 'TARDE', 'NOCHE', 'MIXTO', 'ROTATIVO'],
    }),
    ApiQuery({
      name: 'modalidad',
      description: 'Filtra por modalidad laboral general.',
      required: false,
      enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'],
    }),
    ApiQuery({
      name: 'duracion',
      description: 'Filtra por tipo de duración de jornada.',
      required: false,
      enum: ['TIEMPO_COMPLETO', 'TIEMPO_PARCIAL'],
    }),
    ApiQuery({
      name: 'activo',
      description: 'Filtra por jornadas activas o inactivas.',
      required: false,
      schema: { type: 'boolean' },
    }),
    ApiResponse({
      status: 200,
      description: 'Lista de jornadas obtenida exitosamente.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT inválido.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El rol autenticado no posee privilegios de consulta.',
    }),
  );
}

/**
 * Decorador para documentar el endpoint de actualización de una jornada en Swagger.
 */
export function ApiSwaggerActualizarJornada() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar Jornada',
      description:
        'Actualiza los parámetros, áreas aplicables o distribución horaria de una jornada laboral existente.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la jornada a actualizar.',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string', example: 'Turno Mañana Flexible' },
          descripcion: { type: 'string', example: 'Actualización de tolerancia y áreas' },
          duracion: { type: 'string', enum: ['TIEMPO_COMPLETO', 'TIEMPO_PARCIAL'] },
          turno: { type: 'string', enum: ['MANANA', 'TARDE', 'NOCHE', 'MIXTO', 'ROTATIVO'] },
          modalidad: { type: 'string', enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'] },
          tolerancia_minutos: { type: 'number', example: 10 },
          areas_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
          horario_semanal: {
            type: 'array',
            items: { type: 'object' },
          },
          patron_rotacion: { type: 'object' },
          activo: { type: 'boolean', example: true },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Jornada actualizada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos o nombre duplicado en otra jornada.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. Permisos insuficientes.',
    }),
    ApiResponse({
      status: 404,
      description: 'Jornada no encontrada o áreas no válidas.',
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
      description:
        'Desactiva una jornada laboral del catálogo. Bloquea la acción si existen colaboradores activos asignados a ella.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID de la jornada a desactivar.',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiResponse({
      status: 200,
      description: 'Jornada desactivada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Operación bloqueada. Existen colaboradores activos usando este turno.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.',
    }),
    ApiResponse({
      status: 404,
      description: 'Jornada no encontrada o ya desactivada.',
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
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiResponse({
      status: 200,
      description: 'Jornada reactivada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'La jornada ya se encuentra activa.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido.',
    }),
    ApiResponse({
      status: 404,
      description: 'Jornada no encontrada.',
    }),
  );
}

// Aliases de retrocompatibilidad para imports existentes
export const ApiSwaggerJordanaController = ApiSwaggerJornadaController;
export const ApiSwaggerCrearJordana = ApiSwaggerCrearJornada;
export const ApiSwaggerListarJordana = ApiSwaggerListarJornada;
export const ApiSwaggerActualizarJordana = ApiSwaggerActualizarJornada;
export const ApiSwaggerDesactivarJordana = ApiSwaggerDesactivarJornada;
export const ApiSwaggerReactivarJordana = ApiSwaggerReactivarJornada;