//src/modules/RRHH/organizacion/decorators/area-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  ActualizarAreaSchema,
  AreaDetalleSchema,
  AreaResumenSchema,
  CrearAreaSchema,
  ListarAreasQuerySchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_AREA = ['ADMIN', 'RRHH'];

const respuestaAreaSimple: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    descripcion: { type: 'string', nullable: true },
    activo: { type: 'boolean' },
    deleted_at: { type: 'string', format: 'date-time', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para áreas.
 */
export function ApiSwaggerAreasController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Áreas'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/area/crear`.
 */
export function ApiSwaggerCrearArea() {
  return applyDecorators(
    ApiContratoBody(CrearAreaSchema),
    ApiOperacionDocumentada({
      summary: 'Crear área',
      description:
        'Registra un área organizacional activa validando que el nombre no exista entre áreas no eliminadas (insensible a mayúsculas).',
      roles: ROLES_AREA,
      status: 201,
      respuesta: respuestaAreaSimple,
    })
  );
}

/**
 * Documenta `PUT /api/v1/rrhh/area/:id`.
 */
export function ApiSwaggerActualizarArea() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(ActualizarAreaSchema),
    ApiOperacionDocumentada({
      summary: 'Actualizar área',
      description:
        'Modifica nombre y/o descripción de un área no eliminada. Verifica colisión de nombre cuando cambia respecto al valor actual.',
      roles: ROLES_AREA,
      respuesta: respuestaAreaSimple,
    })
  );
}

/**
 * Documenta `DELETE /api/v1/rrhh/area/:id/desactivar`.
 */
export function ApiSwaggerDesactivarArea() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Desactivar área (baja lógica)',
      description:
        'Marca el área como inactiva y registra `deleted_at`. Rechaza la operación con 400 si tiene empleados activos o cargos activos asociados.',
      roles: ROLES_AREA,
      respuesta: respuestaAreaSimple,
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/area/:id/reactivar`.
 */
export function ApiSwaggerReactivarArea() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Reactivar área',
      description:
        'Restaura un área desactivada estableciendo `activo: true` y limpiando `deleted_at`. Responde 400 si el área ya se encuentra activa.',
      roles: ROLES_AREA,
      respuesta: respuestaAreaSimple,
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/area`.
 */
export function ApiSwaggerListarAreas() {
  return applyDecorators(
    ApiContratoQuery(ListarAreasQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar áreas',
      description:
        'Devuelve el listado paginado de áreas no eliminadas ordenadas por nombre, con filtros por estado activo y búsqueda textual e incluye conteos de cargos, empleados y jornadas.',
      roles: ROLES_AREA,
      respuesta: { type: 'array', items: esquemaContrato(AreaResumenSchema) },
      paginada: true,
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/area/:id`.
 */
export function ApiDetalleArea() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de área',
      description:
        'Recupera un área no eliminada junto con sus cargos no eliminados y las jornadas asociadas.',
      roles: ROLES_AREA,
      respuesta: esquemaContrato(AreaDetalleSchema),
    })
  );
}
