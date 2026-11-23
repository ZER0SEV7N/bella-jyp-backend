//src/modules/RRHH/organizacion/decorators/cargo-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  ActualizarCargoSchema,
  CargoDetalleSchema,
  CargoResumenSchema,
  CrearCargoSchema,
  ListarCargosQuerySchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_CARGO = ['ADMIN', 'RRHH'];
const respuestaCargoDetalle = esquemaContrato(CargoDetalleSchema);
const respuestaCargoSinArea: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    id_area: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
    descripcion: { type: 'string', nullable: true },
    sueldo_minimo: { type: 'string', nullable: true },
    sueldo_maximo: { type: 'string', nullable: true },
    activo: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    deleted_at: { type: 'string', format: 'date-time', nullable: true },
  },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para cargos.
 */
export function ApiSwaggerCargosController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Cargos y Puestos de Trabajo'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/cargo/crear`.
 */
export function ApiSwaggerCrearCargo() {
  return applyDecorators(
    ApiContratoBody(CrearCargoSchema),
    ApiOperacionDocumentada({
      summary: 'Crear cargo',
      description:
        'Registra un cargo en un área activa (404 si no existe o está inactiva). Valida nombre único dentro del área, asigna sueldo mínimo 1130.0 por defecto y exige que el sueldo máximo no sea menor al mínimo.',
      roles: ROLES_CARGO,
      status: 201,
      respuesta: respuestaCargoDetalle,
    })
  );
}

/**
 * Documenta `PUT /api/v1/rrhh/cargo/:id`.
 */
export function ApiSwaggerActualizarCargo() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(ActualizarCargoSchema),
    ApiOperacionDocumentada({
      summary: 'Actualizar cargo',
      description:
        'Actualiza parcialmente un cargo existente. Si cambia de área valida que el destino esté activo (404), comprueba unicidad de nombre en el área destino y valida la consistencia de la banda salarial.',
      roles: ROLES_CARGO,
      respuesta: respuestaCargoDetalle,
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/cargo`.
 */
export function ApiSwaggerListarCargos() {
  return applyDecorators(
    ApiContratoQuery(ListarCargosQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar cargos',
      description:
        'Devuelve el catálogo paginado de cargos no eliminados ordenados por nombre, con filtros por área, estado activo y búsqueda textual e incluye conteo de empleados activos.',
      roles: ROLES_CARGO,
      respuesta: { type: 'array', items: esquemaContrato(CargoResumenSchema) },
      paginada: true,
    })
  );
}

/**
 * Documenta `DELETE /api/v1/rrhh/cargo/:id/desactive`.
 */
export function ApiSwaggerDesactivarCargo() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Desactivar cargo (baja lógica)',
      description:
        'Desactiva un cargo registrando `deleted_at`. Bloquea la operación con 400 si existen empleados activos asignados al cargo.',
      roles: ROLES_CARGO,
      respuesta: respuestaCargoSinArea,
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/cargo/:id/reactivar`.
 */
export function ApiSwaggerReactivarCargo() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Reactivar cargo',
      description:
        'Reactiva un cargo desactivado verificando que no esté ya activo (400) y que su área matriz exista y permanezca activa (404).',
      roles: ROLES_CARGO,
      respuesta: respuestaCargoDetalle,
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/cargo/:id`.
 */
export function ApiDetalleCargo() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de cargo',
      description:
        'Recupera un cargo no eliminado junto con la referencia de su área asociada.',
      roles: ROLES_CARGO,
      respuesta: respuestaCargoDetalle,
    })
  );
}
