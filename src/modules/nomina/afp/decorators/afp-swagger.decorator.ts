//src/modules/nomina/afp/decorators/afp-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  ComisionAfpDetalleSchema,
  CrearComisionSchema,
  CrearTipoAfpSchema,
  ListarComisionesQuerySchema,
  ListarTiposAfpQuerySchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * Decorador de nivel controlador para agrupar las operaciones del módulo de AFP y Pensiones.
 */
export function ApiSwaggerAfpController() {
  return applyDecorators(
    ApiTags('Módulo Nomina - AFP y Pensiones'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/nomina/afp/comisiones`.
 */
export function ApiSwaggerComisionCrear() {
  return applyDecorators(
    ApiContratoBody(CrearComisionSchema),
    ApiOperacionDocumentada({
      summary: 'Registrar nueva comisión de AFP',
      description:
        'Registra una nueva vigencia de tasas SBS (SCD Tipo 2) para una AFP. Si no se indica comisión anterior, cierra automáticamente la última vigencia abierta en la fecha indicada o el día previo al nuevo inicio; valida que el inicio no sea anterior a la vigencia previa.',
      roles: ['JYP'],
      status: 201,
      respuesta: esquemaContrato(ComisionAfpDetalleSchema),
    }),
    ApiResponse({
      status: 500,
      description: 'Error interno al intentar registrar la comisión de la AFP.',
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/afp/comisiones`.
 */
export function ApiSwaggerComisionListar() {
  return applyDecorators(
    ApiContratoQuery(ListarComisionesQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar comisiones de AFP',
      description:
        'Obtiene el historial paginado de tasas ordenado por período de inicio descendente. Permite filtrar por AFP y limitar a vigencias abiertas (`solo_vigentes`).',
      roles: ['ADMIN', 'CONTADOR', 'ASISTENTE', 'RRHH'],
      respuesta: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            afp_id: { type: 'string', format: 'uuid' },
            afp_nombre: { type: 'string' },
            periodo_inicio: { type: 'string', format: 'date-time' },
            periodo_final: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            aporte_obligatorio: { type: 'number' },
            comision_sobre_ra: { type: 'number' },
            prima_seguro: { type: 'number' },
            comision_mixta: { type: 'number' },
          },
        },
      },
      paginada: true,
    })
  );
}

/**
 * Documenta `POST /api/v1/nomina/afp/tipos`.
 */
export function ApiSwaggerTipoAfpCrear() {
  return applyDecorators(
    ApiContratoBody(CrearTipoAfpSchema),
    ApiOperacionDocumentada({
      summary: 'Crear tipo de AFP',
      description:
        'Registra una nueva administradora de fondos de pensiones. Valida que el régimen pertenezca a un sistema AFP y que no exista otra AFP con el mismo nombre.',
      roles: ['JYP'],
      status: 201,
      respuesta: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          id_regimen: { type: 'string', format: 'uuid' },
          nombre: { type: 'string' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Error interno al intentar registrar la nueva AFP.',
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/afp/tipos`.
 */
export function ApiSwaggerTipoAfpListar() {
  return applyDecorators(
    ApiContratoQuery(ListarTiposAfpQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar tipos de AFP',
      description:
        'Devuelve el catálogo paginado de administradoras de AFP ordenado alfabéticamente por nombre, incluyendo el nombre de su régimen de pensión.',
      roles: ['ADMIN', 'CONTADOR', 'ASISTENTE', 'RRHH'],
      respuesta: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            id_regimen: { type: 'string', format: 'uuid' },
            nombre: { type: 'string' },
            regimen_pension: {
              type: 'object',
              properties: {
                nombre: { type: 'string' },
              },
            },
          },
        },
      },
      paginada: true,
    })
  );
}
