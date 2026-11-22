//src/modules/RRHH/organizacion/decorators/empleado-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  CambiarEstadoLaboralSchema,
  CrearEmpleadoSchema,
  DesactivarEmpleadoSchema,
  EditarEmpleadoSchema,
  EmpleadoDetalleSchema,
  EmpleadoResumenSchema,
  ListarEmpleadosQuerySchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_ESCRITURA = ['ADMIN', 'RRHH'];
const ROLES_LECTURA = ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'];

const referenciaCatalogo: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    nombre: { type: 'string' },
  },
};

const respuestaEmpleadoMutacion: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    cargo_id: { type: 'string', format: 'uuid' },
    area_id: { type: 'string', format: 'uuid' },
    documento_id: { type: 'string', format: 'uuid' },
    jornada_id: { type: 'string', format: 'uuid', nullable: true },
    estado_laboral: {
      type: 'string',
      enum: [
        'ACTIVO',
        'CESADO',
        'DESPEDIDO',
        'SUSPENDIDO',
        'VACACIONES',
        'LICENCIA',
      ],
    },
    nombre: { type: 'string' },
    apellido: { type: 'string' },
    nro_documento: { type: 'string' },
    email: { type: 'string', format: 'email' },
    telefono: { type: 'string' },
    sexo: { type: 'string', enum: ['MASCULINO', 'FEMENINO'] },
    estado_civil: {
      type: 'string',
      enum: ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'],
    },
    nacionalidad: { type: 'string' },
    fecha_nacimiento: { type: 'string', format: 'date-time' },
    direccion: { type: 'string' },
    referencia_direccion: { type: 'string' },
    ubigeo: { type: 'string' },
    distrito: { type: 'string' },
    provincia: { type: 'string' },
    departamento: { type: 'string' },
    fecha_inicio: { type: 'string', format: 'date-time' },
    fecha_cese: { type: 'string', format: 'date-time', nullable: true },
    afp_fecha_filiacion: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    asig_familiar: { type: 'boolean' },
    activo: { type: 'boolean' },
    estado_sincronizacion: { type: 'string' },
    deleted_at: { type: 'string', format: 'date-time', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    area: referenciaCatalogo,
    cargo: referenciaCatalogo,
    jornada: { ...referenciaCatalogo, nullable: true },
  },
};

const respuestaEmpleadoSinJornada: SchemaObject = {
  type: 'object',
  properties: Object.fromEntries(
    Object.entries(respuestaEmpleadoMutacion.properties ?? {}).filter(
      ([clave]) => clave !== 'jornada'
    )
  ),
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para empleados.
 */
export function ApiSwaggerEmpleadosController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Empleados y Colaboradores'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/empleado`.
 */
export function ApiSwaggerCrearEmpleado() {
  return applyDecorators(
    ApiContratoBody(CrearEmpleadoSchema),
    ApiOperacionDocumentada({
      summary: 'Crear colaborador',
      description:
        'Registra un colaborador activo validando documento único (400), área/cargo/tipo de documento existentes (404) y jornada activa (400). Si faltara nombre o apellido para DNI de 8 dígitos intenta consultar RENIEC.',
      roles: ROLES_ESCRITURA,
      status: 201,
      respuesta: respuestaEmpleadoMutacion,
    })
  );
}

/**
 * Documenta `PUT /api/v1/rrhh/empleado/:id`.
 */
export function ApiSwaggerActualizarEmpleado() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(EditarEmpleadoSchema),
    ApiOperacionDocumentada({
      summary: 'Actualizar colaborador',
      description:
        'Actualiza parcialmente un legajo no eliminado. Impide cambiar `jornada_id` si existe historial en `asistencia_jornada` (400), impide anular `afp_fecha_filiacion` si tiene AFP registrada (400) y valida documento único y entidades activas.',
      roles: ROLES_ESCRITURA,
      respuesta: respuestaEmpleadoMutacion,
    })
  );
}

/**
 * Documenta `DELETE /api/v1/rrhh/empleado/:id/desactivar`.
 */
export function ApiSwaggerDesactivarEmpleado() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(DesactivarEmpleadoSchema.optional()),
    ApiOperacionDocumentada({
      summary: 'Desactivar colaborador (cese / baja lógica)',
      description:
        'Da de baja el legajo marcando `activo: false`, `estado_laboral: CESADO`, `fecha_cese` (fecha actual del servidor) y `deleted_at`. Acepta un cuerpo opcional validado con `DesactivarEmpleadoSchema`.',
      roles: ROLES_ESCRITURA,
      respuesta: respuestaEmpleadoSinJornada,
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/empleado/:id/reactivar`.
 */
export function ApiSwaggerReactivarEmpleado() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Reactivar colaborador',
      description:
        'Restaura un legajo dado de baja estableciendo `activo: true`, `estado_laboral: ACTIVO`, `fecha_cese: null` y `deleted_at: null`. Responde 400 si el colaborador ya se encuentra activo.',
      roles: ROLES_ESCRITURA,
      respuesta: {
        type: 'object',
        properties: {
          state: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: respuestaEmpleadoSinJornada,
        },
      },
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/empleado/:id/estado-laboral`.
 */
export function ApiSwaggerCambiarEstadoLaboral() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(CambiarEstadoLaboralSchema),
    ApiOperacionDocumentada({
      summary: 'Cambiar estado laboral de colaborador activo',
      description:
        'Actualiza `estado_laboral` entre ACTIVO, VACACIONES, LICENCIA y SUSPENDIDO para un colaborador activo (404 si está inactivo o cesado). Rechaza con 400 si el estado solicitado es igual al actual.',
      roles: ROLES_ESCRITURA,
      respuesta: {
        type: 'object',
        properties: {
          state: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: respuestaEmpleadoSinJornada,
        },
      },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/empleado`.
 */
export function ApiSwaggerListarEmpleados() {
  return applyDecorators(
    ApiContratoQuery(ListarEmpleadosQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar colaboradores',
      description:
        'Devuelve el catálogo paginado de colaboradores ordenados por apellido, incluyendo registros CESADO y DESPEDIDO. Filtra por búsqueda textual, área, cargo, jornada vigente, estado laboral y activo.',
      roles: ROLES_LECTURA,
      respuesta: {
        type: 'array',
        items: esquemaContrato(EmpleadoResumenSchema),
      },
      paginada: true,
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/empleado/:id`.
 */
export function ApiDetalleEmpleado() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de colaborador',
      description:
        'Recupera el legajo completo del colaborador (incluidos CESADO y DESPEDIDO) con su jornada vigente resuelta desde asistencia, tipo de documento, derechohabientes y contratos no eliminados.',
      roles: ROLES_ESCRITURA,
      respuesta: esquemaContrato(EmpleadoDetalleSchema),
    })
  );
}
