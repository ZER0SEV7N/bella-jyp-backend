import { applyDecorators } from '@nestjs/common';
import type { SchemaObject } from '@nestjs/swagger';
import { ApiBody, ApiExtension, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';

//El contrato documental solo necesita reconocer el esquema; evita comparar tipos recursivos entre las dos instalaciones de Zod.
type ContratoZod = { _def: unknown };
type OperacionApi = { summary: string; description: string; roles: string[]; status?: number; respuesta: SchemaObject; paginada?: boolean };

/** Documenta la entrada HTTP de Zod 3, antes de sus transformaciones a Date o valores internos. */
export function esquemaContrato(contrato: ContratoZod): SchemaObject {
    return zodToJsonSchema(contrato as Parameters<typeof zodToJsonSchema>[0], {
        target: 'openApi3',
        effectStrategy: 'input',
        pipeStrategy: 'input',
        $refStrategy: 'none'
    }) as SchemaObject;
}

export function ApiContratoBody(contrato: ContratoZod, ejemplo?: Record<string, unknown>) {
    return ApiBody({ schema: { ...esquemaContrato(contrato), example: ejemplo } });
}

export function ApiContratoQuery(contrato: ContratoZod) {
    const esquema = esquemaContrato(contrato);
    return applyDecorators(
        ...Object.entries(esquema.properties ?? {}).map(([name, schema]) => ApiQuery({ name, required: esquema.required?.includes(name) ?? false, schema }))
    );
}

export function ApiIdentificador(nombre = 'id', uuid = true) {
    return ApiParam({ name: nombre, required: true, schema: { type: 'string', ...(uuid ? { format: 'uuid' } : {}) } });
}

/** Conserva el mismo envoltorio que TransformResponseInterceptor, incluida su variante paginada. */
export function ApiOperacionDocumentada(opciones: OperacionApi) {
    const status = opciones.status ?? 200;
    const meta: SchemaObject = {
        type: 'object',
        properties: { message: { type: 'string' }, path: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } }
    };
    if (opciones.paginada) Object.assign(meta.properties!, { total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' } });
    const respuesta: SchemaObject = {
        type: 'object',
        required: ['statusCode', 'data', 'meta'],
        properties: { statusCode: { type: 'integer', example: status }, data: opciones.respuesta, meta }
    };
    return applyDecorators(
        ApiOperation({ summary: opciones.summary, description: opciones.description }),
        ApiExtension('x-roles', opciones.roles),
        ApiResponse({ status, description: 'Operación procesada correctamente.', schema: respuesta })
    );
}

/** Los errores se documentan con el formato que produce el filtro global RFC 7807. */
export function ApiErroresOperacion() {
    const schema: SchemaObject = {
        type: 'object',
        properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'integer' },
            detail: { type: 'string' },
            instance: { type: 'string' }
        }
    };
    const errores = [
        [400, 'La entrada o una regla de negocio no es válida.'],
        [401, 'Token ausente, vencido o inválido.'],
        [403, 'El rol no permite esta acción.'],
        [404, 'No se encontró el recurso solicitado.'],
        [409, 'Conflicto de estado, versión o fuentes modificadas.']
    ] as const;
    return applyDecorators(...errores.map(([status, description]) => ApiResponse({ status, description, schema })));
}
