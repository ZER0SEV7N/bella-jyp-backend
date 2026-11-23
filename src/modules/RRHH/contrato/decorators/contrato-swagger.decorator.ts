//src/modules/RRHH/contrato/decorators/contrato-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  ContratoDetalleSchema,
  CrearContratoSchema,
  EditarContratoSchema,
  ListarContratosQuerySchema,
  RenovarContratoSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtension,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_ESCRITURA = ['ADMIN', 'RRHH'];
const ROLES_LECTURA = ['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE'];
const ROLES_DESCARGA = ['ADMIN', 'RRHH', 'CONTADOR', 'EMPLEADO'];

const estadoContratoEnum = [
  'VIGENTE',
  'VENCIDO',
  'RENOVADO',
  'ANULADO',
  'FINALIZADO',
];

const propiedadesContratoBase: Record<string, SchemaObject> = {
  id: { type: 'string', format: 'uuid' },
  empleado_id: { type: 'string', format: 'uuid' },
  estado: { type: 'string', enum: estadoContratoEnum },
  contrato_origen_id: { type: 'string', format: 'uuid', nullable: true },
  tipo_modalidad: { type: 'string', nullable: true },
  fecha_inicio: { type: 'string', format: 'date-time' },
  fecha_fin: { type: 'string', format: 'date-time', nullable: true },
  renovado: { type: 'boolean' },
  observacion: { type: 'string', nullable: true },
  deleted_at: { type: 'string', format: 'date-time', nullable: true },
  created_at: { type: 'string', format: 'date-time' },
  url: { type: 'string', nullable: true },
};

const respuestaContratoResumen: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    empleado_id: { type: 'string', format: 'uuid' },
    colaborador: { type: 'string' },
    nro_documento: { type: 'string' },
    area: { type: 'string' },
    cargo: { type: 'string' },
    estado: { type: 'string', enum: estadoContratoEnum },
    tipo_modalidad: { type: 'string' },
    fecha_inicio: { type: 'string', format: 'date-time' },
    fecha_fin: { type: 'string', format: 'date-time', nullable: true },
    dias_restantes: { type: 'integer', nullable: true },
    alerta_vencimiento: {
      type: 'string',
      enum: ['VENCIDO', 'CRITICO', 'PREVENTIVO', 'REGULAR'],
      nullable: true,
    },
    contrato_origen_id: { type: 'string', format: 'uuid', nullable: true },
    es_prorroga: { type: 'boolean' },
    tiene_archivo: { type: 'boolean' },
  },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para contratos.
 */
export function ApiSwaggerContratoController() {
  return applyDecorators(
    ApiTags('RRHH - Contratos'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/contrato`.
 */
export function ApiSwaggerCrearContrato() {
  return applyDecorators(
    ApiContratoBody(CrearContratoSchema),
    ApiOperacionDocumentada({
      summary: 'Crear contrato',
      description:
        'Registra un contrato sin PDF adjunto (`url: null`) para un empleado activo (404 si no existe o está inactivo). Valida que `fecha_inicio` no sea posterior a `fecha_fin` (400).',
      roles: ROLES_ESCRITURA,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          ...propiedadesContratoBase,
          empleados: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              nombre: { type: 'string' },
              apellido: { type: 'string' },
              nro_documento: { type: 'string' },
            },
          },
        },
      },
    })
  );
}

/**
 * Documenta `PUT /api/v1/rrhh/contrato/:id`.
 */
export function ApiSwaggerEditarContrato() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(EditarContratoSchema),
    ApiOperacionDocumentada({
      summary: 'Editar contrato sin PDF firmado',
      description:
        'Actualiza los datos de un contrato no eliminado sin permitir cambiar `empleado_id`. Bloquea la edición con 400 si el contrato ya tiene un PDF adjunto (`url !== null`).',
      roles: ROLES_ESCRITURA,
      respuesta: { type: 'object', properties: propiedadesContratoBase },
    })
  );
}

/**
 * Documenta `POST /api/v1/rrhh/contrato/:id/renovar`.
 */
export function ApiSwaggerRenovarContrato() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(RenovarContratoSchema),
    ApiOperacionDocumentada({
      summary: 'Renovar contrato',
      description:
        'Marca el contrato previo como `RENOVADO` y crea en transacción un nuevo contrato `VIGENTE` vinculado por `contrato_origen_id`. Rechaza si el empleado está inactivo, si el contrato ya fue renovado o si `fecha_inicio > fecha_fin` (400).',
      roles: ROLES_ESCRITURA,
      status: 201,
      respuesta: { type: 'object', properties: propiedadesContratoBase },
    })
  );
}

/**
 * Documenta `DELETE /api/v1/rrhh/contrato/:id/anular`.
 */
export function ApiSwaggerAnularContrato() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Anular contrato (baja lógica)',
      description:
        'Cambia el estado del contrato a `ANULADO` y registra `deleted_at`. Responde 404 si no existe o ya fue eliminado y 400 si ya estaba anulado.',
      roles: ROLES_ESCRITURA,
      respuesta: { type: 'object', properties: propiedadesContratoBase },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/contrato`.
 */
export function ApiSwaggerListarContratos() {
  return applyDecorators(
    ApiContratoQuery(ListarContratosQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar contratos',
      description:
        'Lista contratos no eliminados con filtros por empleado, estado, área, búsqueda textual y `por_vencer_dias` (contratos vigentes próximos a vencer), calculando `dias_restantes` y `alerta_vencimiento`.',
      roles: ROLES_LECTURA,
      respuesta: { type: 'array', items: respuestaContratoResumen },
      paginada: true,
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/contrato/empleado/:empleadoId`.
 */
export function ApiSwaggerListarContratosEmpleado() {
  return applyDecorators(
    ApiIdentificador('empleadoId'),
    ApiContratoQuery(ListarContratosQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar contratos de un empleado',
      description:
        'Verifica que el empleado exista y no esté eliminado (404) y devuelve su historial paginado de contratos aplicando los filtros opcionales de consulta.',
      roles: ROLES_LECTURA,
      respuesta: { type: 'array', items: respuestaContratoResumen },
      paginada: true,
    })
  );
}

/**
 * Documenta `POST /api/v1/rrhh/contrato/:id/subir-pdf`.
 */
export function ApiSwaggerSubirPdf() {
  return applyDecorators(
    ApiIdentificador(),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description:
              'Archivo PDF del contrato firmado (`application/pdf`, extensión `.pdf`, máx. 5 MB).',
          },
        },
      },
    }),
    ApiOperacionDocumentada({
      summary: 'Subir PDF firmado de contrato',
      description:
        'Guarda el archivo PDF en `archivos/contratos` (máx. 5 MB), vincula `url` y anota la fecha en `observacion`, impidiendo futuras ediciones. Rechaza con 400 si ya tenía PDF o el archivo no es PDF válido.',
      roles: ROLES_ESCRITURA,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          url: { type: 'string' },
        },
      },
    }),
    ApiResponse({
      status: 413,
      description: 'El archivo PDF supera el tamaño máximo de 5 MB.',
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/contrato/descargar/:filename`.
 */
export function ApiSwaggerDescargarPdf() {
  return applyDecorators(
    ApiIdentificador('filename', false),
    ApiOperation({
      summary: 'Descargar PDF de contrato',
      description:
        'Envía el binario PDF del contrato validando el nombre con `path.basename` y extensión `.pdf` (400). Verifica en BD que el registro no esté eliminado (`deleted_at: null`) y, si el rol es EMPLEADO, que tenga `empleado_id` (403) y que el contrato le pertenezca (404). Si el archivo no existe en disco responde 400 (`El archivo solicitado no existe.`).',
    }),
    ApiExtension('x-roles', ROLES_DESCARGA),
    ApiProduces('application/pdf'),
    ApiResponse({
      status: 200,
      description: 'Archivo PDF descargado correctamente.',
      content: {
        'application/pdf': { schema: { type: 'string', format: 'binary' } },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        "El nombre del archivo PDF es inválido o responde 'El archivo solicitado no existe.' (400, no 404) cuando no se encuentra en disco.",
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/contrato/:id`.
 */
export function ApiSwaggerListarContratosPorId() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de contrato',
      description:
        'Recupera un contrato no eliminado por su UUID junto con los datos básicos del colaborador y sus prórrogas.',
      roles: ROLES_ESCRITURA,
      respuesta: esquemaContrato(ContratoDetalleSchema),
    })
  );
}
