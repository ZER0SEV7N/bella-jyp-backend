//src/modules/afp/decorators/afp-swagger.decorator.ts
import { CrearComisionSchema, CrearTipoAfpSchema, ListarComisionesQuerySchema, ListarTiposAfpQuerySchema } from '@jyp/shared-contracts';
import { ApiContratoBody, ApiContratoQuery } from '@/common/decorators/api-contrato.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExtension } from '@nestjs/swagger';

/**
 * Decoradores de Swagger para el módulo de AFP.
 */
//========================================================
//CONTROLADOR GLOBAL
//========================================================
export function ApiSwaggerAfpController() {
  return applyDecorators(
    ApiTags('Módulo AFP y Pensiones'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-role', { roles: ['ADMIN', 'CONTADOR'] })
  );
}

// ========================================================
// COMISIONES (Tasas SBS)
// ========================================================
export function ApiSwaggerComisionCrear() {
  return applyDecorators(
    ApiOperation({
      summary: 'Registrar nueva Comisión',
      description: 'Abre un nuevo periodo de tasas y cierra el anterior (SCD Tipo 2). Requiere permisos de administrador o contador.',
    }),
    ApiContratoBody(CrearComisionSchema),
    ApiResponse({
      status: 201,
      description: 'Comisión registrada exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Error de validación o datos duplicados.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT inválido o ausente.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.',
    }),
    ApiResponse({
      status: 404,
      description: 'No se encontró la AFP o la comisión anterior especificada.',
    }),
    ApiResponse({
      status: 500,
      description: 'Error interno del servidor al intentar registrar la comisión.',
    })
  );
}

export function ApiSwaggerComisionListar() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar Comisiones',
      description:
        'Obtiene el historial de tasas. Filtre por vigentes para el cálculo de planillas. Requiere permisos de administrador, contador, asistente o RRHH.',
    }),
    ApiContratoQuery(ListarComisionesQuerySchema),

    ApiResponse({
      status: 200,
      description: 'Listado de comisiones obtenido exitosamente.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT inválido o ausente.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.',
    }),
    ApiResponse({
      status: 500,
      description: 'Error interno del servidor al intentar obtener el listado de comisiones.',
    })
  );
}

// ========================================================
// TIPOS DE AFP
// ========================================================
export function ApiSwaggerTipoAfpCrear() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Tipo de AFP',
      description: 'Registra una nueva Administradora (Ej. Integra, Prima). Requiere permisos de administrador o contador.',
    }),
    ApiContratoBody(CrearTipoAfpSchema),
    ApiResponse({
      status: 201,
      description: 'Tipo de AFP registrado exitosamente.',
    }),
    ApiResponse({
      status: 400,
      description: 'Error de validación o datos duplicados.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT inválido o ausente.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.',
    }),
    ApiResponse({
      status: 500,
      description: 'Error interno del servidor al intentar registrar el tipo de AFP.',
    })
  );
}

export function ApiSwaggerTipoAfpListar() {
  return applyDecorators(
    ApiOperation({ summary: 'Listar Tipos de AFP' }),
    ApiContratoQuery(ListarTiposAfpQuerySchema),

    ApiResponse({
      status: 200,
      description: 'Listado de tipos de AFP obtenido exitosamente.',
    }),
    ApiResponse({
      status: 401,
      description: 'No autorizado. Token JWT inválido o ausente.',
    }),
    ApiResponse({
      status: 403,
      description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.',
    }),
    ApiResponse({
      status: 500,
      description: 'Error interno del servidor al intentar obtener el listado de tipos de AFP.',
    })
  );
}
