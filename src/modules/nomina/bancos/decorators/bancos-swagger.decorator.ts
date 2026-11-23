//src/modules/nomina/bancos/decorators/bancos-swagger.decorator.ts
import {
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import { BancoDetalleSchema } from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Decorador de nivel controlador para el submódulo de Bancos.
 */
export function ApiSwaggerBancosController() {
  return applyDecorators(
    ApiTags('Modulo de Nomina - submodulo de Bancos'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `GET /api/v1/nomina/bancos`.
 */
export function ApiSwaggerListarBancos() {
  return applyDecorators(
    ApiOperacionDocumentada({
      summary: 'Listar catálogo de entidades financieras',
      description:
        'Devuelve la lista de bancos registrados ordenada alfabéticamente por nombre (`id` y `nombre`) para cuentas de sueldo y CTS.',
      roles: ['ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE'],
      respuesta: { type: 'array', items: esquemaContrato(BancoDetalleSchema) },
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/bancos/:id`.
 */
export function ApiSwaggerObtenerBancoPorId() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de banco',
      description:
        'Recupera el registro de una entidad financiera por su UUID. Devuelve 404 si no existe.',
      roles: ['ADMIN', 'CONTADOR', 'RRHH', 'ASISTENTE'],
      respuesta: esquemaContrato(BancoDetalleSchema),
    })
  );
}
