//src/modules/afp/decorators/afp-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiQuery, ApiExtension } from '@nestjs/swagger';

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
        ApiExtension('x-role', { roles: ['ADMIN', 'CONTADOR'] }, )
    );
}

//========================================================
//APORTACIONES
//========================================================
export function ApiSwaggerAportacionCrear() {
    return applyDecorators(
        ApiOperation({ summary: 'Registrar Aportación', description: 'Registra un nuevo aporte o fondo para una AFP específica. Requiere permisos de administrador o contador.' }),
        ApiBody({ 
            schema: { 
                type: 'object', 
                required: ['nombre', 'afp_id', 'cantidad'], 
                properties: { 
                    nombre: { type: 'string', example: 'Aporte Voluntario 2026' }, 
                    afp_id: { type: 'string', format: 'uuid' }, 
                    cantidad: { type: 'number', example: 150.50 } 
                } 
            } 
        }),
        ApiResponse({ status: 201, description: 'Aportación registrada exitosamente.' }),
        ApiResponse({ status: 400, description: 'Error de validación o datos duplicados.' }),
        ApiResponse({ status: 401, description: 'No autorizado. Token JWT inválido o ausente.' }),
        ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.' }),
        ApiResponse({ status: 500, description: 'Error interno del servidor al intentar registrar la aportación.' })
    );
}

export function ApiSwaggerAportacionListar() {
    return applyDecorators(
        ApiOperation({ summary: 'Listar Aportaciones', description: 'Obtiene el listado paginado de aportaciones. Requiere permisos de administrador, contador, asistente, RRHH.' }),
        ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
        ApiQuery({ name: 'limit', required: false, type: Number, example: 50 }),
        ApiQuery({ name: 'afp_id', required: false, type: 'string', format: 'uuid', description: 'Filtrar por AFP' }),
        ApiResponse({ status: 200, description: 'Listado de aportaciones obtenido exitosamente.' }),
        ApiResponse({ status: 401, description: 'No autorizado. Token JWT inválido o ausente.' }),
        ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.' }),
        ApiResponse({ status: 500, description: 'Error interno del servidor al intentar obtener el listado de aportaciones.' })
    );
}

// ========================================================
// COMISIONES (Tasas SBS)
// ========================================================
export function ApiSwaggerComisionCrear() {
    return applyDecorators(
        ApiOperation({ summary: 'Registrar nueva Comisión', description: 'Abre un nuevo periodo de tasas y cierra el anterior (SCD Tipo 2). Requiere permisos de administrador o contador.' }),
        ApiBody({ 
            schema: { 
                type: 'object', 
                required: ['tipo_afp_id', 'nueva_comision'], 
                properties: { 
                    tipo_afp_id: { type: 'string', format: 'uuid', description: 'ID de la AFP a la que aplica' },
                    anterior_comision: { 
                        type: 'object', 
                        description: 'Opcional. Datos de la comisión vigente para cerrarla.',
                        properties: { id: { type: 'string', format: 'uuid' }, periodo_final: { type: 'string', format: 'date', example: '2026-07-31' } }
                    },
                    nueva_comision: {
                        type: 'object',
                        properties: {
                            periodo_inicio: { type: 'string', format: 'date', example: '2026-08-01' },
                            aporte_obligatorio: { type: 'number', example: 10.00 },
                            comision_sobre_ra: { type: 'number', example: 1.55 },
                            prima_seguro: { type: 'number', example: 1.84 },
                            comision_mixta: { type: 'number', example: 0.78 }
                        }
                    }
                } 
            } 
        }),
        ApiResponse({ status: 201, description: 'Comisión registrada exitosamente.' }),
        ApiResponse({ status: 400, description: 'Error de validación o datos duplicados.' }),
        ApiResponse({ status: 401, description: 'No autorizado. Token JWT inválido o ausente.' }),
        ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.' }),
        ApiResponse({ status: 404, description: 'No se encontró la AFP o la comisión anterior especificada.' }),
        ApiResponse({ status: 500, description: 'Error interno del servidor al intentar registrar la comisión.' })
    );
}

export function ApiSwaggerComisionListar() {
    return applyDecorators(
        ApiOperation({ summary: 'Listar Comisiones', description: 'Obtiene el historial de tasas. Filtre por vigentes para el cálculo de planillas. Requiere permisos de administrador, contador, asistente o RRHH.' }),
        ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
        ApiQuery({ name: 'limit', required: false, type: Number, example: 50 }),
        ApiQuery({ name: 'afp_id', required: false, type: 'string', format: 'uuid' }),
        ApiQuery({ name: 'solo_vigentes', required: false, type: Boolean, example: true, description: 'Trae solo las tasas actuales (sin fecha de fin)' }),
        ApiResponse({ status: 200, description: 'Listado de comisiones obtenido exitosamente.' }),
        ApiResponse({ status: 401, description: 'No autorizado. Token JWT inválido o ausente.' }),
        ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.' }),
        ApiResponse({ status: 500, description: 'Error interno del servidor al intentar obtener el listado de comisiones.' })
    );
}

// ========================================================
// TIPOS DE AFP
// ========================================================
export function ApiSwaggerTipoAfpCrear() {
    return applyDecorators(
        ApiOperation({ summary: 'Crear Tipo de AFP', description: 'Registra una nueva Administradora (Ej. Integra, Prima). Requiere permisos de administrador o contador.' }),
        ApiBody({ 
            schema: { 
                type: 'object', 
                required: ['nombre', 'id_regimen'], 
                properties: { 
                    nombre: { type: 'string', example: 'AFP Integra' }, 
                    id_regimen: { type: 'string', format: 'uuid', description: 'ID del Régimen Privado' } 
                } 
            } 
        }),
        ApiResponse({ status: 201, description: 'Tipo de AFP registrado exitosamente.' }),
        ApiResponse({ status: 400, description: 'Error de validación o datos duplicados.' }),
        ApiResponse({ status: 401, description: 'No autorizado. Token JWT inválido o ausente.' }),
        ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.' }),
        ApiResponse({ status: 500, description: 'Error interno del servidor al intentar registrar el tipo de AFP.' })
    );
}

export function ApiSwaggerTipoAfpListar() {
    return applyDecorators(
        ApiOperation({ summary: 'Listar Tipos de AFP' }),
        ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
        ApiQuery({ name: 'limit', required: false, type: Number, example: 50 }),
        ApiResponse({ status: 200, description: 'Listado de tipos de AFP obtenido exitosamente.' }),
        ApiResponse({ status: 401, description: 'No autorizado. Token JWT inválido o ausente.' }),
        ApiResponse({ status: 403, description: 'Prohibido. El usuario no tiene los roles necesarios para realizar esta acción.' }),
        ApiResponse({ status: 500, description: 'Error interno del servidor al intentar obtener el listado de tipos de AFP.' })
    );
}