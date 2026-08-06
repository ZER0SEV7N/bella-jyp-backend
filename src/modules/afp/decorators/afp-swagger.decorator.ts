import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

// ========================================================
// CONTROLADOR GLOBAL
// ========================================================
export function ApiSwaggerAfpController() {
    return applyDecorators(
        ApiTags('Módulo AFP y Pensiones'), 
        ApiBearerAuth('JWT-auth')
    );
}

// ========================================================
// APORTACIONES
// ========================================================
export function ApiSwaggerAportacionCrear() {
    return applyDecorators(
        ApiOperation({ summary: 'Registrar Aportación', description: 'Registra un nuevo aporte o fondo para una AFP específica.' }),
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
        ApiResponse({ status: 201, description: 'Aportación registrada exitosamente.' })
    );
}

export function ApiSwaggerAportacionListar() {
    return applyDecorators(
        ApiOperation({ summary: 'Listar Aportaciones', description: 'Obtiene el listado paginado de aportaciones.' }),
        ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
        ApiQuery({ name: 'limit', required: false, type: Number, example: 50 }),
        ApiQuery({ name: 'afp_id', required: false, type: 'string', format: 'uuid', description: 'Filtrar por AFP' })
    );
}

// ========================================================
// COMISIONES (Tasas SBS)
// ========================================================
export function ApiSwaggerComisionCrear() {
    return applyDecorators(
        ApiOperation({ summary: 'Registrar nueva Comisión', description: 'Abre un nuevo periodo de tasas y cierra el anterior (SCD Tipo 2).' }),
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
        })
    );
}

export function ApiSwaggerComisionListar() {
    return applyDecorators(
        ApiOperation({ summary: 'Listar Comisiones', description: 'Obtiene el historial de tasas. Filtre por vigentes para el cálculo de planillas.' }),
        ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
        ApiQuery({ name: 'limit', required: false, type: Number, example: 50 }),
        ApiQuery({ name: 'afp_id', required: false, type: 'string', format: 'uuid' }),
        ApiQuery({ name: 'solo_vigentes', required: false, type: Boolean, example: true, description: 'Trae solo las tasas actuales (sin fecha de fin)' })
    );
}

// ========================================================
// TIPOS DE AFP
// ========================================================
export function ApiSwaggerTipoAfpCrear() {
    return applyDecorators(
        ApiOperation({ summary: 'Crear Tipo de AFP', description: 'Registra una nueva Administradora (Ej. Integra, Prima).' }),
        ApiBody({ 
            schema: { 
                type: 'object', 
                required: ['nombre', 'id_regimen'], 
                properties: { 
                    nombre: { type: 'string', example: 'AFP Integra' }, 
                    id_regimen: { type: 'string', format: 'uuid', description: 'ID del Régimen Privado' } 
                } 
            } 
        })
    );
}

export function ApiSwaggerTipoAfpListar() {
    return applyDecorators(
        ApiOperation({ summary: 'Listar Tipos de AFP' }),
        ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
        ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
    );
}