//src/modules/RRHH/tareas/decorators/tareas-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
} from '@/common/decorators/api-contrato.decorator';
import {
  CambiarEstadoTareaSchema,
  CrearAnotacionSchema,
  CrearTareaSchema,
  ObtenerTareasQuerySchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_FLUJO = ['ADMIN', 'CONTADOR', 'ASISTENTE'];

const estadoTareaEnum = [
  'PENDIENTE',
  'REVISION',
  'APROBADO',
  'RECHAZADO',
  'AUDITADO',
];

const propiedadesTareaBase: Record<string, SchemaObject> = {
  id: { type: 'string', format: 'uuid' },
  asignado_a: { type: 'string', format: 'uuid' },
  asignado_por: { type: 'string', format: 'uuid' },
  titulo: { type: 'string' },
  descripcion: { type: 'string', nullable: true },
  fecha_entrega: { type: 'string', format: 'date-time', nullable: true },
  estado: { type: 'string', enum: estadoTareaEnum },
  anotaciones: { type: 'string', nullable: true },
  deleted_at: { type: 'string', format: 'date-time', nullable: true },
  created_at: { type: 'string', format: 'date-time' },
  updated_at: { type: 'string', format: 'date-time' },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para tareas.
 */
export function ApiSwaggerTareasController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Tareas'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/tareas`.
 */
export function ApiSwaggerCrearTarea() {
  return applyDecorators(
    ApiContratoBody(CrearTareaSchema),
    ApiOperacionDocumentada({
      summary: 'Crear tarea',
      description:
        'Crea una tarea en estado `PENDIENTE` verificando que el usuario destino (`asignado_a`) esté activo y no eliminado (404). El endpoint no define `@Roles`, por lo que acepta cualquier usuario con JWT válido y registra `asignado_por` desde la sesión.',
      roles: [],
      status: 201,
      respuesta: { type: 'object', properties: propiedadesTareaBase },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/tareas`.
 */
export function ApiSwaggerObtenerTareas() {
  return applyDecorators(
    ApiContratoQuery(ObtenerTareasQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar tareas',
      description:
        'Lista tareas no eliminadas ordenadas por creación descendente con filtro opcional por `estado`. ASISTENTE solo visualiza tareas asignadas a su usuario, CONTADOR ve las asignadas a él o creadas por él y ADMIN visualiza todas.',
      roles: ROLES_FLUJO,
      respuesta: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ...propiedadesTareaBase,
            usuarios_tareas_asistente_asignado_aTousuarios: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                rol: { type: 'string' },
              },
            },
            usuarios_tareas_asistente_asignado_porTousuarios: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                rol: { type: 'string' },
              },
            },
            _count: {
              type: 'object',
              properties: { anotacion_tareas: { type: 'integer' } },
            },
          },
        },
      },
      paginada: true,
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/tareas/:id/estado`.
 */
export function ApiSwaggerCambiarEstadoTarea() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(CambiarEstadoTareaSchema),
    ApiOperacionDocumentada({
      summary: 'Cambiar estado de tarea',
      description:
        'Actualiza el estado de una tarea no eliminada (404 si no existe). Impide con 400 que un usuario con rol ASISTENTE cambie el estado a `APROBADO` o `AUDITADO`.',
      roles: ['CONTADOR', 'ADMIN', 'ASISTENTE'],
      respuesta: { type: 'object', properties: propiedadesTareaBase },
    })
  );
}

/**
 * Documenta `POST /api/v1/rrhh/tareas/:id/anotaciones`.
 */
export function ApiSwaggerAgregarAnotacionTarea() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(CrearAnotacionSchema),
    ApiOperacionDocumentada({
      summary: 'Agregar anotación a tarea',
      description:
        'Registra una anotación asociada a una tarea no eliminada (404 si no existe) guardando `asignado_por` con el usuario autenticado.',
      roles: ['CONTADOR', 'ADMIN', 'ASISTENTE'],
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tarea_id: { type: 'string', format: 'uuid' },
          asignado_por: { type: 'string', format: 'uuid' },
          descripcion: { type: 'string' },
          deleted_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}
