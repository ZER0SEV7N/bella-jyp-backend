//src/modules/core/catalogos/decorators/catalogos-swagger.decorator.ts
import {
  ApiErroresOperacion,
  ApiOperacionDocumentada,
} from '@/common/decorators/api-contrato.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

/**
 * Decorador de nivel controlador para el submódulo de Catálogos.
 */
export function ApiSwaggerCatalogosController() {
  return applyDecorators(
    ApiTags('Modulo Core - submodulo de Catalogos'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/** Esquema de una lista simple de catálogo (arreglo de objetos). */
const esquemaLista = (properties: Record<string, SchemaObject>): SchemaObject => ({
  type: 'array',
  items: { type: 'object', properties },
});

/**
 * Documenta `GET /api/v1/core/catalogos/tipos-documento`.
 */
export function ApiSwaggerListarTiposDocumento() {
  return applyDecorators(
    ApiOperacionDocumentada({
      summary: 'Listar tipos de documento de identidad',
      description:
        'Devuelve los tipos de documento (DNI, CE, PASAPORTE…) con su `id` para formularios de empleados y derechohabientes.',
      roles: ['ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE'],
      respuesta: esquemaLista({
        id: { type: 'string', format: 'uuid' },
        tipo_documento: { type: 'string' },
      }),
    })
  );
}

/**
 * Documenta `GET /api/v1/core/catalogos/regimenes-pensionarios`.
 */
export function ApiSwaggerListarRegimenesPension() {
  return applyDecorators(
    ApiOperacionDocumentada({
      summary: 'Listar regímenes pensionarios',
      description:
        'Devuelve los regímenes de pensión (ONP, SPP/AFP) con su `id` para los datos financieros.',
      roles: ['ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE'],
      respuesta: esquemaLista({
        id: { type: 'string', format: 'uuid' },
        nombre: { type: 'string' },
      }),
    })
  );
}

/**
 * Documenta `GET /api/v1/core/catalogos/modalidades-contrato`.
 */
export function ApiSwaggerListarModalidadesContrato() {
  return applyDecorators(
    ApiOperacionDocumentada({
      summary: 'Listar modalidades de contrato',
      description:
        'Devuelve las modalidades legales de contrato a plazo fijo (D.S. 003-97-TR) con su código y descripción.',
      roles: ['ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE'],
      respuesta: esquemaLista({
        codigo: { type: 'string' },
        descripcion: { type: 'string' },
      }),
    })
  );
}
