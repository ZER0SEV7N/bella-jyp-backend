import type { SchemaObject } from '@nestjs/swagger';

export const respuestaIncidencia: SchemaObject = {
    type: 'object',
    properties: {
        id: { type: 'string', format: 'uuid' },
        empleado_id: { type: 'string', format: 'uuid' },
        periodo: { type: 'string' },
        estado: { type: 'string', enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO'] },
        version: { type: 'integer' },
        vigente: { type: 'boolean' },
        completo: { type: 'boolean' },
        pendientes: { type: 'integer' },
        ...Object.fromEntries(
            [
                'dias_trabajados',
                'dias_vinculo',
                'faltas',
                'dias_sin_goce',
                'minutos_tardanza',
                'minutos_salida_anticipada',
                'minutos_sin_goce',
                'minutos_extras_25',
                'minutos_extras_35'
            ].map((campo) => [campo, { type: 'integer' as const }])
        ),
        horas_extras_25: { type: 'string' },
        horas_extras_35: { type: 'string' },
        detalle: {
            type: 'object',
            nullable: true,
            properties: {
                version_motor: { type: 'string' },
                dias: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            fecha: { type: 'string', format: 'date' },
                            estado: { type: 'string' },
                            marcas: { type: 'array', items: { type: 'object', additionalProperties: true } },
                            solicitudes: { type: 'array', items: { type: 'string' } },
                            alertas: { type: 'array', items: { type: 'string' } }
                        },
                        additionalProperties: true
                    }
                }
            }
        }
    }
};
export const respuestaMarcacion: SchemaObject = {
    type: 'object',
    properties: {
        id: { type: 'string', format: 'uuid' },
        empleado_id: { type: 'string', format: 'uuid' },
        fecha_hora: { type: 'string', format: 'date-time' },
        tipo_marcacion: { type: 'string', enum: ['ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA'] },
        metodo: { type: 'string' },
        motivo: { type: 'string', nullable: true }
    }
};
export const respuestaImportacion: SchemaObject = {
    type: 'object',
    properties: {
        archivo_hash: { type: 'string' },
        periodo: { type: 'string', nullable: true },
        filas_validas: { type: 'integer', description: 'Filas que superaron la validación de formato; revisar también errores de vínculo laboral.' },
        errores: { type: 'array', items: { type: 'object', properties: { fila: { type: 'integer' }, detalle: { type: 'string' } } } }
    }
};
