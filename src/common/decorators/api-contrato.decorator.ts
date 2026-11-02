//src/common/decorators/api-contrato.decorator.ts
import { applyDecorators } from '@nestjs/common';
import type { SchemaObject } from '@nestjs/swagger';
import { ApiBody, ApiExtension, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Decoradores para documentar los endpoints de la API utilizando contratos Zod.
 * Estos decoradores permiten generar automáticamente la documentación de OpenAPI (Swagger) a partir de los contratos Zod definidos en la aplicación.
 * @requires - zodToJsonSchema para convertir contratos Zod en esquemas JSON compatibles con OpenAPI.
 * @requires - ApiBody, ApiExtension, ApiOperation, ApiParam, ApiQuery, ApiResponse de @nestjs/swagger para aplicar la documentación a los endpoints.
 */

//El contrato documental solo necesita reconocer el esquema; evita comparar tipos recursivos entre las dos instalaciones de Zod.
type ContratoZod = { _def: unknown };
type OperacionApi = {
    summary: string;
    description: string;
    roles: string[];
    status?: number;
    respuesta: SchemaObject;
    paginada?: boolean;
    metaAdicional?: Record<string, SchemaObject>;
};

/**
 * Convierte un contrato Zod en un esquema JSON compatible con OpenAPI.
 * @param contrato - El contrato Zod que se desea convertir a un esquema JSON.
 * @returns - Un objeto SchemaObject que representa el esquema JSON generado a partir del contrato Zod.
 */
export function esquemaContrato(contrato: ContratoZod): SchemaObject {
    //Utiliza la función zodToJsonSchema para convertir el contrato Zod en un esquema JSON compatible con OpenAPI.
    return zodToJsonSchema(contrato as Parameters<typeof zodToJsonSchema>[0], {
        target: 'openApi3',
        effectStrategy: 'input',
        pipeStrategy: 'input',
        $refStrategy: 'none',
    }) as SchemaObject;
}

/**
 * Decorador para documentar un endpoint que recibe un cuerpo de solicitud basado en un contrato Zod.
 * @param contrato - El contrato Zod que define la estructura del cuerpo de la solicitud.
 * @param ejemplo - Un objeto opcional que proporciona un ejemplo de los datos que se esperan en el cuerpo de la solicitud.
 * @param archivo - Un nombre de propiedad opcional que indica que el cuerpo de la solicitud incluye un archivo binario.
 * @returns - Un decorador que aplica la documentación de OpenAPI para el cuerpo de la solicitud basado en el contrato Zod.
 */
export function ApiContratoBody(contrato: ContratoZod, ejemplo?: Record<string, unknown>, archivo?: string) {
    //Genera el esquema JSON a partir del contrato Zod utilizando la función esquemaContrato.
    const schema = esquemaContrato(contrato);
    if (archivo) 
        schema.properties = { ...schema.properties, [archivo]: { type: 'string', format: 'binary' } };
    return ApiBody({ schema: { ...schema, example: ejemplo } });
}

/**
 * Decorador para documentar un endpoint que recibe parámetros de consulta basados en un contrato Zod.
 * @param contrato - El contrato Zod que define la estructura de los parámetros de consulta.
 * @returns - Un decorador que aplica la documentación de OpenAPI para los parámetros de consulta basados en el contrato Zod.
 */
export function ApiContratoQuery(contrato: ContratoZod) {
    //Genera el esquema JSON a partir del contrato Zod utilizando la función esquemaContrato.
    const esquema = esquemaContrato(contrato);
    
    //Itera sobre las propiedades del esquema JSON y aplica el decorador ApiQuery para cada parámetro de consulta, indicando si es requerido o no según el contrato Zod.
    return applyDecorators(
        ...Object.entries(esquema.properties ?? {}).map(([name, schema]) =>
            ApiQuery({ name, required: esquema.required?.includes(name) ?? false, schema })
        )
    );
}

//Decorador para documentar un endpoint que recibe un parámetro de ruta basado en un contrato Zod.
export function ApiIdentificador(nombre = 'id', uuid = true) { return ApiParam({ name: nombre, required: true, schema: { type: 'string', ...(uuid ? { format: 'uuid' } : {}) } }); }

/**
 * Decorador para documentar un endpoint de la API con información detallada sobre la operación, incluyendo resumen, descripción, roles permitidos, código de estado y esquema de respuesta.
 * @param opciones - Un objeto que contiene las opciones de documentación para la operación de la API, incluyendo resumen, descripción, roles permitidos, código de estado y esquema de respuesta.
 * @returns - Un decorador que aplica la documentación de OpenAPI para la operación de la API según las opciones proporcionadas.
 */
export function ApiOperacionDocumentada(opciones: OperacionApi) {
    //Establece el código de estado predeterminado en 200 si no se proporciona en las opciones.
    const status = opciones.status ?? 200;
    
    //Define el esquema de metadatos que se incluirá en la respuesta de la operación de la API, incluyendo propiedades como mensaje, ruta y marca de tiempo.
    const meta: SchemaObject = {
        type: 'object',
        properties: { message: { type: 'string' }, path: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } },
    };

    //Si la operación es paginada, 
    //agrega propiedades adicionales al esquema de metadatos para incluir información sobre la paginación, como total de elementos, página actual, límite de elementos por página y total de páginas.
    if (opciones.paginada)
        Object.assign(meta.properties, {
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
        });
    
    //Si se proporcionan metadatos adicionales en las opciones, 
    //los agrega al esquema de metadatos para incluir información personalizada en la respuesta de la operación de la API.
    Object.assign(meta.properties, opciones.metaAdicional);
    
    //Define el esquema de respuesta que se utilizará para documentar la operación de la API, incluyendo propiedades como código de estado, datos de respuesta y metadatos.
    const respuesta: SchemaObject = {
        type: 'object',
        required: ['statusCode', 'data', 'meta'],
        properties: { statusCode: { type: 'integer', example: status }, data: opciones.respuesta, meta },
    };

    //Aplica los decoradores de documentación de OpenAPI para la operación de la API, incluyendo resumen, descripción, roles permitidos y esquema de respuesta.
    return applyDecorators(
        ApiOperation({ summary: opciones.summary, description: opciones.description }),
        ApiExtension('x-roles', opciones.roles),
        ApiResponse({ status, description: 'Operación procesada correctamente.', schema: respuesta })
    );
}

/**
 * Decorador para documentar los posibles errores de operación que pueden ocurrir en un endpoint de la API.
 * Permite especificar los códigos de estado HTTP y las descripciones de los errores que pueden ser devueltos por la operación de la API.
 * @returns - Un decorador que aplica la documentación de OpenAPI para los posibles errores de operación en el endpoint de la API.
 */
export function ApiErroresOperacion() {
    //Define el esquema de error que se utilizará para documentar los posibles errores de operación, incluyendo propiedades como tipo, título, código de estado, detalle y ruta del error.
    const schema: SchemaObject = {
        type: 'object',
        properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'integer' },
            detail: { type: 'string' },
            instance: { type: 'string' },
        },
    };

    //Define un arreglo de posibles errores de operación, cada uno representado por un código de estado HTTP y una descripción del error correspondiente.
    const errores = [
        [400, 'La entrada o una regla de negocio no es válida.'],
        [401, 'Token ausente, vencido o inválido.'],
        [403, 'El rol no permite esta acción.'],
        [404, 'No se encontró el recurso solicitado.'],
        [409, 'Conflicto de estado, versión o fuentes modificadas.'],
    ] as const;

    //Aplica los decoradores de documentación de OpenAPI para cada posible error de operación, 
    //especificando el código de estado y la descripción del error, así como el esquema de respuesta que describe la estructura del error devuelto por la API.
    return applyDecorators(...errores.map(([status, description]) => ApiResponse({ status, description, schema })));
}
