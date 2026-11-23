//src/modules/RRHH/organizacion/decorators/jornada-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  ActualizarJornadaSchema,
  CrearJornadaSchema,
  JornadaDetalleSchema,
  JornadaResumenSchema,
  ListarJornadasQuerySchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_ESCRITURA = ['ADMIN', 'RRHH'];
const ROLES_LECTURA = ['ADMIN', 'RRHH', 'CONTADOR'];

const respuestaJornadaBase: Record<string, SchemaObject> = {
  id: { type: 'string', format: 'uuid' },
  nombre: { type: 'string' },
  descripcion: { type: 'string', nullable: true },
  duracion: { type: 'string', enum: ['TIEMPO_COMPLETO', 'TIEMPO_PARCIAL'] },
  turno: {
    type: 'string',
    enum: ['MANANA', 'TARDE', 'NOCHE', 'MIXTO', 'ROTATIVO'],
  },
  modalidad: { type: 'string', enum: ['PRESENCIAL', 'REMOTO', 'HIBRIDO'] },
  tolerancia_minutos: { type: 'integer' },
  total_horas_semana: { type: 'string' },
  horario_semanal: {
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  },
  patron_rotacion: {
    type: 'object',
    nullable: true,
    additionalProperties: true,
  },
  activo: { type: 'boolean' },
  deleted_at: { type: 'string', format: 'date-time', nullable: true },
  created_at: { type: 'string', format: 'date-time' },
  updated_at: { type: 'string', format: 'date-time' },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para jornadas.
 */
export function ApiSwaggerJornadaController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Jornadas y Horarios Laborales'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/jornadas`.
 */
export function ApiSwaggerCrearJornada() {
  return applyDecorators(
    ApiContratoBody(CrearJornadaSchema),
    ApiOperacionDocumentada({
      summary: 'Crear jornada laboral',
      description:
        'Registra una jornada y la asocia a áreas activas (404 si alguna no existe o está inactiva). Valida nombre único (400), máximo 8h/día, máximo 48h semanales (menos de 30h para TIEMPO_PARCIAL) y patrón de rotación obligatorio si el turno es ROTATIVO.',
      roles: ROLES_ESCRITURA,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          ...respuestaJornadaBase,
          areas_aplicables_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/jornadas`.
 */
export function ApiSwaggerListarJornada() {
  return applyDecorators(
    ApiContratoQuery(ListarJornadasQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar jornadas laborales',
      description:
        'Lista jornadas no eliminadas ordenadas por fecha de creación descendente, con filtros por búsqueda, área, turno, modalidad, duración y estado activo, e incluye conteo de empleados activos y áreas vinculadas.',
      roles: ROLES_LECTURA,
      respuesta: {
        type: 'array',
        items: esquemaContrato(JornadaResumenSchema),
      },
      paginada: true,
    })
  );
}

/**
 * Documenta `PUT /api/v1/rrhh/jornadas/:id`.
 */
export function ApiSwaggerActualizarJornada() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(ActualizarJornadaSchema),
    ApiOperacionDocumentada({
      summary: 'Actualizar jornada laboral',
      description:
        'Actualiza una jornada no eliminada. Valida nombre único si cambia (400), áreas activas si se reemplaza `areas_ids` (404) y recalcula horas si se envía `horario_semanal`.',
      roles: ROLES_ESCRITURA,
      respuesta: esquemaContrato(JornadaDetalleSchema),
    })
  );
}

/**
 * Documenta `DELETE /api/v1/rrhh/jornadas/:id/desactivar`.
 */
export function ApiSwaggerDesactivarJornada() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Desactivar jornada (baja lógica)',
      description:
        'Desactiva una jornada registrando `deleted_at`. Bloquea la operación con 400 si existen empleados activos asignados a esta jornada.',
      roles: ROLES_ESCRITURA,
      respuesta: { type: 'object', properties: respuestaJornadaBase },
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/jornadas/:id/reactivar`.
 */
export function ApiSwaggerReactivarJornada() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Reactivar jornada',
      description:
        'Reactiva una jornada desactivada estableciendo `activo: true` y limpiando `deleted_at`. Responde 400 si ya se encuentra activa.',
      roles: ROLES_ESCRITURA,
      respuesta: { type: 'object', properties: respuestaJornadaBase },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/jornadas/:id`.
 */
export function ApiDetalleJornada() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de jornada',
      description:
        'Recupera una jornada no eliminada junto con sus áreas asociadas y configuración horaria semanal.',
      roles: ROLES_ESCRITURA,
      respuesta: esquemaContrato(JornadaDetalleSchema),
    })
  );
}
