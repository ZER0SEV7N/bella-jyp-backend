//src/modules/RRHH/solicitudes/decorator/solicitudes-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  CrearSolicitudSchema,
  EvaluarSolicitudSchema,
  ListarSolicitudesQuerySchema,
  SolicitudResumenSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_GESTION = ['ADMIN', 'RRHH'];
const ROLES_LECTURA = ['ADMIN', 'RRHH', 'CONTADOR', 'EMPLEADO'];
const ROLES_CREACION = ['ADMIN', 'RRHH', 'EMPLEADO'];

const propiedadesSolicitudCompleta: Record<string, SchemaObject> = {
  id: { type: 'string', format: 'uuid' },
  codigo: { type: 'string', example: 'SOL-2026-001' },
  empleado_id: { type: 'string', format: 'uuid' },
  tipo: {
    type: 'string',
    enum: [
      'VACACIONES',
      'ADELANTO_VACACIONES',
      'VENTA_VACACIONES',
      'LICENCIA_MEDICA',
      'PERMISO',
      'JUSTIFICACION_ASISTENCIA',
      'ACTUALIZACION_DATOS',
      'ADELANTO_SUELDO',
      'RENUNCIA',
    ],
  },
  estado: {
    type: 'string',
    enum: ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'ANULADA'],
  },
  fecha_inicio: { type: 'string', format: 'date-time', nullable: true },
  fecha_fin: { type: 'string', format: 'date-time', nullable: true },
  hora_inicio: { type: 'string', nullable: true },
  hora_fin: { type: 'string', nullable: true },
  efecto_asistencia: {
    type: 'string',
    enum: ['PENDIENTE_DEFINIR', 'CON_GOCE', 'SIN_GOCE', 'NO_APLICA'],
  },
  dias_solicitados: { type: 'integer', nullable: true },
  monto: { type: 'string', nullable: true },
  motivo: { type: 'string' },
  observacion: { type: 'string', nullable: true },
  sustento_url: { type: 'string', nullable: true },
  sustento_nombre: { type: 'string', nullable: true },
  responsable_id: { type: 'string', format: 'uuid', nullable: true },
  fecha_limite: { type: 'string', format: 'date-time', nullable: true },
  origen: {
    type: 'string',
    enum: ['PORTAL_EMPLEADO', 'MANUAL_RRHH', 'APLICACION_MOVIL'],
  },
  created_at: { type: 'string', format: 'date-time' },
  updated_at: { type: 'string', format: 'date-time' },
  deleted_at: { type: 'string', format: 'date-time', nullable: true },
  empleados: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      nombre: { type: 'string' },
      apellido: { type: 'string' },
      nro_documento: { type: 'string' },
      fecha_inicio: { type: 'string', format: 'date-time' },
      area: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nombre: { type: 'string' },
        },
      },
      cargo: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nombre: { type: 'string' },
        },
      },
    },
  },
  responsable: {
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email' },
      rol: { type: 'string' },
      empleados: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          apellido: { type: 'string' },
        },
      },
    },
  },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para solicitudes.
 */
export function ApiSwaggerSolicitudController() {
  return applyDecorators(
    ApiTags('Módulo RRHH - Gestión de Solicitudes y Permisos'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/solicitudes`.
 */
export function ApiSwaggerCrearSolicitud() {
  return applyDecorators(
    ApiConsumes('application/json', 'multipart/form-data'),
    ApiContratoBody(CrearSolicitudSchema, undefined, 'archivo'),
    ApiOperacionDocumentada({
      summary: 'Crear solicitud',
      description:
        'Registra una solicitud en estado `PENDIENTE` con código `SOL-YYYY-NNN` y auditoría transaccional. Soporta JSON o `multipart/form-data` con un adjunto PDF/Word en `archivo` (máx. 5 MB); restringe a EMPLEADO a su propio legajo sin observación ni origen distinto a PORTAL_EMPLEADO.',
      roles: ROLES_CREACION,
      status: 201,
      respuesta: { type: 'object', properties: propiedadesSolicitudCompleta },
    }),
    ApiResponse({
      status: 413,
      description: 'El archivo adjunto supera el tamaño máximo de 5 MB.',
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/solicitudes`.
 */
export function ApiSwaggerListarSolicitudes() {
  return applyDecorators(
    ApiContratoQuery(ListarSolicitudesQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar solicitudes',
      description:
        'Lista solicitudes paginadas con filtros por estado, tipo, área, búsqueda textual y rango `fecha_desde`/`fecha_hasta` (`YYYY-MM-DD`). Si el rol es EMPLEADO solo devuelve sus propias solicitudes; `meta` incluye `total_sin_estado` y `por_estado`.',
      roles: ROLES_LECTURA,
      respuesta: {
        type: 'array',
        items: esquemaContrato(SolicitudResumenSchema),
      },
      paginada: true,
      metaAdicional: {
        total_sin_estado: { type: 'integer' },
        por_estado: {
          type: 'object',
          properties: {
            PENDIENTE: { type: 'integer' },
            EN_REVISION: { type: 'integer' },
            APROBADA: { type: 'integer' },
            RECHAZADA: { type: 'integer' },
            ANULADA: { type: 'integer' },
          },
        },
      },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/solicitudes/:idOCodigo`.
 */
export function ApiSwaggerObtenerDetalleSolicitud() {
  return applyDecorators(
    ApiIdentificador('idOCodigo', false),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de solicitud',
      description:
        'Recupera una solicitud por UUID o código `SOL-YYYY-NNN` (incluyendo anuladas), calculando `colaborador_resumen` con antigüedad y `alerta_urgencia`. Si el rol es EMPLEADO solo puede consultar sus propias solicitudes.',
      roles: ROLES_LECTURA,
      respuesta: {
        type: 'object',
        properties: {
          ...propiedadesSolicitudCompleta,
          colaborador_resumen: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              nombre_completo: { type: 'string' },
              documento: { type: 'string' },
              area: { type: 'string' },
              cargo: { type: 'string' },
              antiguedad: { type: 'string' },
            },
          },
          alerta_urgencia: {
            type: 'object',
            nullable: true,
            properties: {
              mensaje: { type: 'string' },
              detalle: { type: 'string' },
            },
          },
        },
      },
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/solicitudes/:id/asignar-revision`.
 */
export function ApiSwaggerAsignarRevision() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Tomar solicitud en revisión',
      description:
        'Asigna al usuario ADMIN/RRHH autenticado como responsable y pasa la solicitud a `EN_REVISION` con auditoría. Es idempotente si ya la tomó el mismo usuario y responde 409 si finalizó o la tomó otro revisor.',
      roles: ROLES_GESTION,
      respuesta: { type: 'object', properties: propiedadesSolicitudCompleta },
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/solicitudes/:id/evaluar`.
 */
export function ApiSwaggerEvaluarSolicitud() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(EvaluarSolicitudSchema),
    ApiOperacionDocumentada({
      summary: 'Evaluar solicitud (aprobar o rechazar)',
      description:
        'Dictamina una solicitud `EN_REVISION` tomada por el evaluador (403 si otro responsable, 409 si otro estado). Exige `observacion` de 5 a 2000 caracteres al rechazar y valida que los períodos afectados no tengan incidencias aprobadas ni planilla cerrada al aprobar (409).',
      roles: ROLES_GESTION,
      respuesta: { type: 'object', properties: propiedadesSolicitudCompleta },
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/solicitudes/:id/anular`.
 */
export function ApiSwaggerAnularSolicitud() {
  return applyDecorators(
    ApiIdentificador(),
    ApiBody({
      schema: {
        type: 'object',
        required: ['motivo'],
        properties: {
          motivo: {
            type: 'string',
            minLength: 5,
            maxLength: 3000,
            example:
              'Colaborador cancela la solicitud por reprogramación interna de vacaciones.',
          },
        },
      },
    }),
    ApiOperacionDocumentada({
      summary: 'Anular solicitud',
      description:
        'Anula una solicitud en estado `PENDIENTE` o `EN_REVISION` exigiendo `motivo` (5 a 3000 caracteres), conserva `deleted_at: null` para consulta histórica y registra el evento en auditoría.',
      roles: ROLES_GESTION,
      respuesta: { type: 'object', properties: propiedadesSolicitudCompleta },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/solicitudes/:idOCodigo/historial`.
 */
export function ApiSwaggerObtenerHistorialSolicitud() {
  return applyDecorators(
    ApiIdentificador('idOCodigo', false),
    ApiOperacionDocumentada({
      summary: 'Obtener historial de solicitud',
      description:
        'Consulta los eventos de `audit_log` de una solicitud por UUID o código `SOL-YYYY-NNN` en orden cronológico. El rol EMPLEADO solo puede consultar sus propias solicitudes.',
      roles: ROLES_LECTURA,
      respuesta: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            accion: {
              type: 'string',
              enum: [
                'CREADA',
                'INICIO_REVISION',
                'APROBADA',
                'RECHAZADA',
                'ANULADA',
                'REASIGNADA',
                'ASIGNADA',
                'DESASIGNADA',
                'ACTUALIZADA',
                'ELIMINADA',
              ],
            },
            fecha: { type: 'string', format: 'date-time' },
            actor: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid', nullable: true },
                email: { type: 'string', nullable: true },
                nombre_completo: { type: 'string' },
              },
            },
            cambios: {
              type: 'object',
              properties: {
                estado: {
                  type: 'object',
                  properties: {
                    anterior: { nullable: true },
                    nuevo: { nullable: true },
                  },
                },
                responsable_id: {
                  type: 'object',
                  properties: {
                    anterior: { nullable: true },
                    nuevo: { nullable: true },
                  },
                },
                observacion: {
                  type: 'object',
                  properties: {
                    anterior: { nullable: true },
                    nuevo: { nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    })
  );
}
