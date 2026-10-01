// src/modules/payroll/bancos/decorators/bancos-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

export function ApiSwaggerBancosController() {
  return applyDecorators(
    ApiTags('Payroll - Bancos'),
    ApiBearerAuth('JWT-auth'),
  );
}

export function ApiSwaggerListarBancos() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar catálogo de entidades financieras',
      description: 'Devuelve la lista ordenada de bancos disponibles para cuentas de sueldo y CTS.',
    }),
    ApiResponse({
      status: 200,
      description: 'Catálogo recuperado exitosamente.',
      schema: {
        example: [
          { id: '018f4a7c-4444-7000-d000-000000000001', nombre: 'Banco de Crédito del Perú (BCP)' },
          { id: '018f4a7c-4444-7000-d000-000000000002', nombre: 'BBVA Perú' },
          { id: '018f4a7c-4444-7000-d000-000000000003', nombre: 'Interbank' },
          { id: '018f4a7c-4444-7000-d000-000000000004', nombre: 'Scotiabank Perú' }
        ]
      }
    }),
    ApiResponse({ status: 401, description: 'No autenticado.' })
  );
}