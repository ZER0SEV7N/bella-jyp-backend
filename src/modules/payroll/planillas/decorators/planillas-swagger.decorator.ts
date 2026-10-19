import { ApiContratoBody, ApiContratoQuery, ApiErroresOperacion, ApiIdentificador, ApiOperacionDocumentada } from '@/common/decorators/api-contrato.decorator';
import { CongelarPlanillaSchema, CrearNovedadPlanillaSchema, DetalleAsistenciaQuerySchema, GenerarPlanillasSchema, ListarPlanillasSchema, RegistrarDesembolsoSchema, ResolverNovedadPlanillaSchema } from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiExtension, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { respuestaConsultaTrabajo, respuestaNovedad, respuestaPlanilla, respuestaTrabajo } from './planillas-respuestas.swagger';

const operadores = ['ADMIN', 'CONTADOR', 'ASISTENTE'];
const contador = ['CONTADOR'];

export function ApiSwaggerPlanillasController() {
    return applyDecorators(ApiTags('Payroll - Planillas'), ApiBearerAuth('JWT-auth'), ApiErroresOperacion());
}
export function ApiSwaggerGenerarPlanillas() {
    return applyDecorators(
        ApiContratoBody(GenerarPlanillasSchema),
        ApiOperacionDocumentada({
            summary: 'Solicitar generación de planillas',
            description:
                'Encola el cálculo por colaborador o área. solicitud_id es la clave de idempotencia del actor. El resultado se consulta mediante trabajo_id.',
            roles: operadores,
            status: 202,
            respuesta: respuestaTrabajo
        })
    );
}
export function ApiSwaggerConsultarTrabajoPlanillas() {
    return applyDecorators(
        ApiIdentificador('id', false),
        ApiOperacionDocumentada({
            summary: 'Consultar progreso del cálculo',
            description: 'Devuelve progreso y errores por colaborador. El asistente consulta sus propios trabajos; ADMIN y CONTADOR pueden consultar otros.',
            roles: operadores,
            respuesta: respuestaConsultaTrabajo
        })
    );
}
export function ApiSwaggerListarPlanillas() {
    const { snapshot_calculo: _snapshot, ...properties } = respuestaPlanilla.properties!;
    return applyDecorators(
        ApiContratoQuery(ListarPlanillasSchema),
        ApiOperacionDocumentada({
            summary: 'Listar planillas por período',
            description: 'Consulta paginada sin instantáneas de cálculo.',
            roles: operadores,
            respuesta: { type: 'array', items: { type: 'object', properties } },
            paginada: true
        })
    );
}
export function ApiSwaggerObtenerPlanilla() {
    return applyDecorators(
        ApiIdentificador(),
        ApiOperacionDocumentada({
            summary: 'Obtener detalle de planilla',
            description: 'Incluye conceptos, versión e instantánea de cálculo.',
            roles: operadores,
            respuesta: respuestaPlanilla
        })
    );
}
export function ApiSwaggerCongelarPlanilla() {
    return applyDecorators(
        ApiIdentificador(),
        ApiContratoBody(CongelarPlanillaSchema),
        ApiOperacionDocumentada({
            summary: 'Validar y congelar la planilla',
            description: 'Solo CONTADOR. Comprueba versión, fuentes e importes; el trigger impide modificaciones posteriores.',
            roles: contador,
            status: 201,
            respuesta: respuestaPlanilla
        })
    );
}
export function ApiSwaggerDescargarBoleta() {
    return applyDecorators(
        ApiIdentificador(),
        ApiOperation({ summary: 'Descargar boleta', description: 'Requiere una planilla validada y genera el PDF desde su instantánea.' }),
        ApiExtension('x-roles', operadores),
        ApiProduces('application/pdf'),
        ApiResponse({
            status: 200,
            description: 'Boleta de una planilla CONGELADO o DECLARADO, generada desde su instantánea.',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } }
        })
    );
}
export function ApiSwaggerRegistrarDesembolso() {
    return applyDecorators(
        ApiContratoBody(RegistrarDesembolsoSchema),
        ApiOperacionDocumentada({
            summary: 'Registrar desembolso de adelanto',
            description: 'Registra la entrega real y el período de descuento de una solicitud aprobada. Solo CONTADOR.',
            roles: contador,
            status: 201,
            respuesta: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    solicitud_id: { type: 'string', format: 'uuid' },
                    empleado_id: { type: 'string', format: 'uuid' },
                    monto: { type: 'string' },
                    fecha: { type: 'string', format: 'date-time' },
                    periodo_descuento: { type: 'string' },
                    referencia: { type: 'string' },
                    usuario_id: { type: 'string', format: 'uuid' }
                }
            }
        })
    );
}
export function ApiSwaggerCrearNovedadPlanilla() {
    return applyDecorators(
        ApiContratoBody(CrearNovedadPlanillaSchema),
        ApiOperacionDocumentada({
            summary: 'Registrar novedad de planilla',
            description: 'Registra un concepto con sustento. Se mantiene pendiente hasta su resolución por el contador.',
            roles: operadores,
            status: 201,
            respuesta: respuestaNovedad
        })
    );
}
export function ApiSwaggerResolverNovedadPlanilla() {
    return applyDecorators(
        ApiIdentificador(),
        ApiContratoBody(ResolverNovedadPlanillaSchema),
        ApiOperacionDocumentada({
            summary: 'Resolver novedad de planilla',
            description: 'Aprueba, rechaza o anula con motivo y versión. Solo una novedad aprobada participa en el cálculo.',
            roles: contador,
            status: 201,
            respuesta: respuestaNovedad
        })
    );
}
export function ApiSwaggerListarNovedadesPlanilla() {
    return applyDecorators(
        ApiContratoQuery(DetalleAsistenciaQuerySchema),
        ApiOperacionDocumentada({
            summary: 'Listar novedades del colaborador',
            description: 'Devuelve hasta cien novedades del período, ordenadas por creación.',
            roles: operadores,
            respuesta: { type: 'array', items: respuestaNovedad }
        })
    );
}
