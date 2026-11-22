//src/modules/nomina/planillas/decorators/planillas-swagger.decorator.ts
import {
  ApiContratoBody,
  ApiContratoQuery,
  ApiErroresOperacion,
  ApiIdentificador,
  ApiOperacionDocumentada,
  esquemaContrato,
} from '@/common/decorators/api-contrato.decorator';
import {
  CongelarPlanillaSchema,
  CrearNovedadPlanillaSchema,
  DetalleAsistenciaQuerySchema,
  GenerarPlanillasSchema,
  ListarPlanillasSchema,
  MisBoletasSchema,
  PlanillaResumenSchema,
  RegistrarDesembolsoSchema,
  ResolverNovedadPlanillaSchema,
} from '@jyp/shared-contracts';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  respuestaConsultaTrabajo,
  respuestaNovedad,
  respuestaPlanilla,
  respuestaTrabajo,
} from './planillas-respuestas.swagger';

const operadores = ['ADMIN', 'CONTADOR', 'ASISTENTE'];
const contador = ['CONTADOR'];

/**
 * Decorador de nivel controlador para planillas, novedades y desembolsos.
 */
export function ApiSwaggerPlanillasController() {
  return applyDecorators(
    ApiTags('Modulo Nomina - Planillas'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Decorador de nivel controlador para la consulta y descarga de boletas propias.
 */
export function ApiSwaggerBoletasPropiasController() {
  return applyDecorators(
    ApiTags('Modulo Nomina - Boletas Propias'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

/**
 * Documenta `POST /api/v1/nomina/planillas/generar`.
 */
export function ApiSwaggerGenerarPlanillas() {
  return applyDecorators(
    ApiContratoBody(GenerarPlanillasSchema),
    ApiOperacionDocumentada({
      summary: 'Solicitar generación de planillas',
      description:
        'Encola el cálculo asíncrono por período, colaborador o área; rechaza períodos futuros (400). `solicitud_id` actúa como clave de idempotencia del actor (409 si se reutiliza con otros filtros) y devuelve `trabajo_id` para seguimiento.',
      roles: operadores,
      status: 202,
      respuesta: respuestaTrabajo,
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/planillas/trabajos/:id`.
 */
export function ApiSwaggerConsultarTrabajoPlanillas() {
  return applyDecorators(
    ApiIdentificador('id', false),
    ApiOperacionDocumentada({
      summary: 'Consultar progreso del cálculo',
      description:
        'Devuelve el estado en cola, progreso y resultado del trabajo de cálculo masivo. El asistente solo consulta trabajos encolados por él; ADMIN y CONTADOR pueden consultar cualquier trabajo.',
      roles: operadores,
      respuesta: respuestaConsultaTrabajo,
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/planillas`.
 */
export function ApiSwaggerListarPlanillas() {
  return applyDecorators(
    ApiContratoQuery(ListarPlanillasSchema),
    ApiOperacionDocumentada({
      summary: 'Listar planillas por período',
      description:
        'Devuelve el resumen paginado de planillas activas del período ordenado por colaborador, con totales monetarios y nombre completo.',
      roles: operadores,
      respuesta: {
        type: 'array',
        items: esquemaContrato(PlanillaResumenSchema),
      },
      paginada: true,
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/planillas/:id`.
 */
export function ApiSwaggerObtenerPlanilla() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperacionDocumentada({
      summary: 'Obtener detalle de planilla',
      description:
        'Recupera todos los conceptos calculados, versión, estado, metadatos de validación y la instantánea de cálculo de una planilla no eliminada.',
      roles: operadores,
      respuesta: respuestaPlanilla,
    })
  );
}

/**
 * Documenta `POST /api/v1/nomina/planillas/:id/congelar`.
 */
export function ApiSwaggerCongelarPlanilla() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(CongelarPlanillaSchema),
    ApiOperacionDocumentada({
      summary: 'Validar y congelar la planilla',
      description:
        'Solo CONTADOR. Verifica versión optimista, vigencia del hash de fuentes, conciliación exacta de importes contra el motor y datos de empresa antes de pasar de ABIERTO a CONGELADO en transacción auditada.',
      roles: contador,
      status: 201,
      respuesta: respuestaPlanilla,
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/planillas/:id/boleta`.
 */
export function ApiSwaggerDescargarBoleta() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperation({
      summary: 'Descargar boleta',
      description:
        'Requiere una planilla en estado CONGELADO o DECLARADO con su instantánea completa y devuelve el PDF generado como archivo adjunto.',
    }),
    ApiExtension('x-roles', operadores),
    ApiProduces('application/pdf'),
    ApiResponse({
      status: 200,
      description:
        'Boleta en PDF de una planilla CONGELADO o DECLARADO, generada desde su instantánea.',
      content: {
        'application/pdf': { schema: { type: 'string', format: 'binary' } },
      },
    })
  );
}

/**
 * Documenta `POST /api/v1/nomina/planillas/desembolsos`.
 */
export function ApiSwaggerRegistrarDesembolso() {
  return applyDecorators(
    ApiContratoBody(RegistrarDesembolsoSchema),
    ApiOperacionDocumentada({
      summary: 'Registrar desembolso de adelanto',
      description:
        'Solo CONTADOR. Valida que la fecha no sea futura, que la solicitud sea de ADELANTO_SUELDO en estado APROBADA con monto positivo y que no tenga desembolso previo, registrando el egreso en transacción auditada.',
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
          usuario_id: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    })
  );
}

/**
 * Documenta `POST /api/v1/nomina/planillas/novedades`.
 */
export function ApiSwaggerCrearNovedadPlanilla() {
  return applyDecorators(
    ApiContratoBody(CrearNovedadPlanillaSchema),
    ApiOperacionDocumentada({
      summary: 'Registrar novedad de planilla',
      description:
        'Registra un bono o descuento con sustento en estado PENDIENTE mediante transacción auditada. Aplica bloqueo por colaborador y limita a cien novedades por colaborador y período.',
      roles: operadores,
      status: 201,
      respuesta: respuestaNovedad,
    })
  );
}

/**
 * Documenta `POST /api/v1/nomina/planillas/novedades/:id/resolver`.
 */
export function ApiSwaggerResolverNovedadPlanilla() {
  return applyDecorators(
    ApiIdentificador(),
    ApiContratoBody(ResolverNovedadPlanillaSchema),
    ApiOperacionDocumentada({
      summary: 'Resolver novedad de planilla',
      description:
        'Solo CONTADOR. Permite aprobar, rechazar o anular una novedad PENDIENTE, o anular una novedad APROBADA, validando la versión optimista en transacción auditada.',
      roles: contador,
      status: 201,
      respuesta: respuestaNovedad,
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/planillas/novedades/listar`.
 */
export function ApiSwaggerListarNovedadesPlanilla() {
  return applyDecorators(
    ApiContratoQuery(DetalleAsistenciaQuerySchema),
    ApiOperacionDocumentada({
      summary: 'Listar novedades del colaborador',
      description:
        'Sin paginación (ignora `page`/`limit`, los cuales tampoco forman parte de `DetalleAsistenciaQuerySchema`, y limita el resultado con `take: 100` ordenado por `created_at` ascendente). Consulta `novedad_planilla` filtrando por `{ empleado_id, periodo }`; sin `empleado_id` devuelve hasta 100 novedades de todos los colaboradores.',
      roles: operadores,
      respuesta: { type: 'array', items: respuestaNovedad },
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/mis-boletas`.
 */
export function ApiSwaggerMisBoletas() {
  return applyDecorators(
    ApiOperacionDocumentada({
      summary: 'Listar boletas propias',
      description:
        'Devuelve hasta 120 boletas en estado CONGELADO o DECLARADO pertenecientes al colaborador autenticado, ordenadas por período descendente.',
      roles: ['EMPLEADO'],
      respuesta: esquemaContrato(MisBoletasSchema),
    })
  );
}

/**
 * Documenta `GET /api/v1/nomina/mis-boletas/:id/pdf`.
 */
export function ApiSwaggerDescargarBoletaPropia() {
  return applyDecorators(
    ApiIdentificador(),
    ApiOperation({
      summary: 'Descargar boleta propia',
      description:
        'Verifica que la planilla pertenezca al colaborador autenticado y esté en estado CONGELADO o DECLARADO con su instantánea, generando y enviando el PDF como archivo adjunto.',
    }),
    ApiExtension('x-roles', ['EMPLEADO']),
    ApiProduces('application/pdf'),
    ApiResponse({
      status: 200,
      description:
        'Boleta en PDF de una planilla CONGELADO o DECLARADO, generada desde su instantánea.',
      content: {
        'application/pdf': { schema: { type: 'string', format: 'binary' } },
      },
    })
  );
}
