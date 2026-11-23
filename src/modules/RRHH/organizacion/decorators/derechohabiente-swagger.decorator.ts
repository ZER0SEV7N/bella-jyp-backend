//src/modules/RRHH/organizacion/decorators/derechohabiente-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  DerechohabienteDetalleSchema,
  RegistrarDerechohabienteSchema,
  SubirSustentoDerechohabienteSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

const ROLES_DERECHOHABIENTE = ['ADMIN', 'RRHH'];

const respuestaDerechohabienteBase: Record<string, SchemaObject> = {
  id: { type: 'string', format: 'uuid' },
  empleado_id: { type: 'string', format: 'uuid' },
  documento_id: { type: 'string', format: 'uuid' },
  nro_documento: { type: 'string' },
  nombres: { type: 'string' },
  apellidos: { type: 'string' },
  vinculo: {
    type: 'string',
    enum: [
      'CONYUGE',
      'CONCUBINO',
      'HIJO_MENOR',
      'HIJO_MAYOR_INCAPACITADO',
      'HIJO_MAYOR_ESTUDIANTE',
      'MADRE_GESTANTE',
    ],
  },
  estado_civil: {
    type: 'string',
    enum: ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'],
  },
  sexo: { type: 'string', enum: ['MASCULINO', 'FEMENINO'] },
  fecha_nacimiento: { type: 'string', format: 'date-time' },
  acreditado_essalud: { type: 'boolean' },
  fecha_alta_seguro: { type: 'string', format: 'date-time', nullable: true },
  activo: { type: 'boolean' },
  deleted_at: { type: 'string', format: 'date-time', nullable: true },
  created_at: { type: 'string', format: 'date-time' },
  updated_at: { type: 'string', format: 'date-time' },
};

/**
 * Configura la etiqueta Swagger, la autenticación Bearer y los errores comunes para derechohabientes.
 */
export function ApiSwaggerDerechohabienteController() {
  return applyDecorators(
    ApiTags('RRHH - Derechohabientes'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/rrhh/derechohabientes/registrar`.
 */
export function ApiSwaggerRegistrarDerechohabiente() {
  return applyDecorators(
    ApiContratoBody(RegistrarDerechohabienteSchema),
    ApiOperacionDocumentada({
      summary: 'Registrar derechohabiente',
      description:
        'Registra un familiar vinculado a un empleado titular activo, valida documento único por titular (409) y rango de edad según vínculo (400). Si el vínculo es HIJO_MENOR o HIJO_MAYOR_ESTUDIANTE, activa `asig_familiar` en el titular dentro de la transacción.',
      roles: ROLES_DERECHOHABIENTE,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          ...respuestaDerechohabienteBase,
          tipo_documento: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              tipo_documento: { type: 'string' },
            },
          },
        },
      },
    })
  );
}

/**
 * Documenta `POST /api/v1/rrhh/derechohabientes/sustento/abrir`.
 */
export function ApiSwaggerSubirSustentoDerechohabiente() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiContratoBody(SubirSustentoDerechohabienteSchema, undefined, 'file'),
    ApiOperacionDocumentada({
      summary: 'Subir sustento documental de derechohabiente',
      description:
        'Recibe un formulario `multipart/form-data` con un archivo PDF o Word (`.pdf`, `.doc`, `.docx`, máx. 5 MB), verifica que el derechohabiente exista y no esté eliminado (404), guarda el archivo en `archivos/derechohabientes` y registra el sustento como vigente.',
      roles: ROLES_DERECHOHABIENTE,
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          derechohabiente_id: { type: 'string', format: 'uuid' },
          tipo_documento: {
            type: 'string',
            enum: [
              'PARTIDA_NACIMIENTO',
              'PARTIDA_MATRIMONIO',
              'ESCRITURA_CONCUBINATO',
              'DNI_DERECHOHABIENTE',
              'CONSTANCIA_ESTUDIOS',
              'CERTIFICADO_INCAPACIDAD',
              'OTRO',
            ],
          },
          nombre_archivo: { type: 'string' },
          archivo_url: { type: 'string' },
          fecha_emision: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          fecha_vencimiento: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          vigente: { type: 'boolean' },
          deleted_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiResponse({
      status: 413,
      description: 'El archivo supera el tamaño máximo de 5 MB.',
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/derechohabientes/empleado/:empleadoId`.
 */
export function ApiSwaggerListarPorEmpleado() {
  return applyDecorators(
    ApiIdentificador('empleadoId'),
    ApiOperacionDocumentada({
      summary: 'Listar derechohabientes de un empleado',
      description:
        'Devuelve los derechohabientes no eliminados asociados al empleado indicado, ordenados de forma descendente por fecha de creación.',
      roles: ROLES_DERECHOHABIENTE,
      respuesta: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            empleado_id: { type: 'string', format: 'uuid' },
            nombres: { type: 'string' },
            apellidos: { type: 'string' },
            nro_documento: { type: 'string' },
            vinculo: respuestaDerechohabienteBase.vinculo,
            fecha_nacimiento: { type: 'string', format: 'date-time' },
            tipo_documento: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                tipo_documento: { type: 'string' },
              },
            },
          },
        },
      },
    })
  );
}

/**
 * Documenta `DELETE /api/v1/rrhh/derechohabientes/:id/desactivar`.
 */
export function ApiSwaggerDesactivarDerechohabiente() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Desactivar derechohabiente (baja lógica)',
      description:
        'Desactiva un derechohabiente activo estableciendo `activo: false` y `deleted_at`. Responde 404 si no existe o ya fue dado de baja.',
      roles: ROLES_DERECHOHABIENTE,
      respuesta: { type: 'object', properties: respuestaDerechohabienteBase },
    })
  );
}

/**
 * Documenta `PATCH /api/v1/rrhh/derechohabientes/:id/reactivar`.
 */
export function ApiSwaggerReactivarDerechohabiente() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Reactivar derechohabiente',
      description:
        'Restaura un derechohabiente dado de baja estableciendo `activo: true` y limpiando `deleted_at`. Responde 400 si ya está activo.',
      roles: ROLES_DERECHOHABIENTE,
      respuesta: { type: 'object', properties: respuestaDerechohabienteBase },
    })
  );
}

/**
 * Documenta `GET /api/v1/rrhh/derechohabientes/:id`.
 */
export function ApiDetalleDerechohabiente() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de derechohabiente',
      description:
        'Recupera la ficha completa de un derechohabiente no eliminado junto con su tipo de documento y sustentos activos.',
      roles: ROLES_DERECHOHABIENTE,
      respuesta: esquemaContrato(DerechohabienteDetalleSchema),
    })
  );
}
