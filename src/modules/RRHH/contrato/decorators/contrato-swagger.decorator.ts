//src/modules/RRHH/contrato/decorators/contrato.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { CrearContratoSchema, EditarContratoSchema, RenovarContratoSchema, ListarContratosQuerySchema } from '@jyp/shared-contracts';
import { ApiContratoBody, ApiContratoQuery, ApiIdentificador } from '@/common/decorators/api-contrato.decorator';

/**
 * Decorador de nivel controlador para agrupar las operaciones de contratos en Swagger.
 */
export function ApiSwaggerContratoController() {
  return applyDecorators(ApiTags('RRHH - Contratos'), ApiBearerAuth('JWT-auth'));
}

/**
 * Documentación del endpoint POST /api/contrato
 */
export function ApiSwaggerCrearContrato() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear Contrato en Borrador',
      description: `Registra un nuevo contrato laboral sin documento PDF adjunto. 
        - **Estado**: Queda registrado en estado borrador/pendiente y habilitado para modificaciones.
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiContratoBody(CrearContratoSchema),
    ApiResponse({ status: 201, description: 'Contrato registrado exitosamente en borrador.' }),
    ApiResponse({ status: 400, description: 'Error de validación (ZodValidationPipe): Fechas incoherentes o datos inválidos.' }),
    ApiResponse({ status: 401, description: 'Token de autenticación ausente o expirado.' }),
    ApiResponse({ status: 403, description: 'Acceso denegado: Se requiere rol ADMIN o RRHH.' }),
    ApiResponse({ status: 409, description: 'Conflicto: El empleado ya posee un contrato vigente en el mismo rango de fechas.' })
  );
}

/**
 * Documentación del endpoint PATCH /api/contrato/:id/actualizar
 */
export function ApiSwaggerEditarContrato() {
  return applyDecorators(
    ApiOperation({
      summary: 'Editar Contrato en Borrador',
      description: `Permite modificar los términos y fechas de un contrato existente.
        - **Regla de Inmutabilidad**: **Solo editable si aún no se ha subido el PDF firmado**. Una vez cargado el archivo digital, el contrato queda congelado legalmente.
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiParam({
      name: 'id',
      type: 'string',
      format: 'uuid',
      description: 'UUID del contrato a modificar',
      example: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
    }),
    ApiContratoBody(EditarContratoSchema),
    ApiResponse({ status: 200, description: 'Contrato actualizado exitosamente.' }),
    ApiResponse({ status: 400, description: 'No se puede editar: El contrato ya cuenta con un PDF firmado o datos inválidos.' }),
    ApiResponse({ status: 404, description: 'El contrato no existe.' })
  );
}

/**
 * Documentación del endpoint POST /api/contrato/:id/renovar
 */
export function ApiSwaggerRenovarContrato() {
  return applyDecorators(
    ApiOperation({
      summary: 'Renovar Contrato (Adenda / Prórroga)',
      description: `Cierra el ciclo del contrato actual marcándolo como renovado y genera de manera atómica un nuevo contrato para el siguiente periodo laboral.
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiParam({
      name: 'id',
      type: 'string',
      format: 'uuid',
      description: 'UUID del contrato previo que finaliza',
      example: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
    }),
    ApiContratoBody(RenovarContratoSchema),
    ApiResponse({ status: 201, description: 'Renovación generada con éxito. Devuelve el nuevo contrato activo.' }),
    ApiResponse({ status: 400, description: 'Error en la secuencia de fechas o estado incompatible para renovación.' }),
    ApiResponse({ status: 404, description: 'Contrato base no encontrado.' })
  );
}

/**
 * Documentación del endpoint DELETE /api/contrato/:id/anular
 */
export function ApiSwaggerAnularContrato() {
  return applyDecorators(
    ApiOperation({
      summary: 'Anular Contrato (Baja Lógica)',
      description: `Realiza la invalidación o soft-delete de un contrato por cancelación de ingreso o anulación administrativa.
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiParam({
      name: 'id',
      type: 'string',
      format: 'uuid',
      description: 'UUID del contrato a anular',
    }),
    ApiResponse({ status: 200, description: 'Contrato anulado exitosamente.' }),
    ApiResponse({ status: 404, description: 'El contrato no existe.' })
  );
}

/**
 * Documentación del endpoint GET /api/contrato (Listado global con filtros y alertas de vencimiento)
 */
export function ApiSwaggerListarContratos() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar contratos con paginación y filtros dinámicos',
      description: `Endpoint multipropósito para la gestión central de contratos de RRHH y alimentación del Dashboard:
        - **Alerta de Vencimiento para Dashboard**: Parámetro \`por_vencer_dias=30\` (o 15, 60) para obtener los contratos que expirarán próximamente.
        - **Filtros Operativos**: Filtrado por área departamental, estado de contrato o búsqueda textual por empleado (nombre, apellido, DNI).
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`, \`CONTADOR\`, \`ASISTENTE\`.`,
    }),
    ApiContratoQuery(ListarContratosQuerySchema),

    ApiResponse({
      status: 200,
      description: 'Listado de contratos obtenido con éxito con metadatos de paginación.',
      schema: {
        example: {
          data: [
            {
              id: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
              empleado: {
                id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                nombres: 'Daniel Enrique',
                apellidos: 'Singer Rojas',
                nro_documento: '72345678',
                area: 'Tecnología de la Información',
                cargo: 'Backend Lead',
              },
              estado: 'VIGENTE',
              tipo_modalidad: 'Plazo Fijo',
              fecha_inicio: '2026-01-01',
              fecha_fin: '2026-10-31',
              dias_restantes: 37,
              tiene_pdf: true,
              nombre_archivo: 'contrato_firmado_daniel_singer.pdf',
            },
          ],
          meta: {
            total: 45,
            page: 1,
            limit: 10,
            totalPages: 5,
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Parámetros de consulta no conformes con ListarContratosQuerySchema.' }),
    ApiResponse({ status: 401, description: 'No autenticado.' }),
    ApiResponse({ status: 403, description: 'Acceso denegado.' })
  );
}

/**
 * Documentación del endpoint GET /api/contrato/empleado/:empleadoId (Historial de un empleado)
 */
export function ApiSwaggerListarContratosEmpleado() {
  return applyDecorators(
    ApiOperation({
      summary: 'Historial contractual completo de un empleado',
      description: `Recupera la línea de tiempo completa de contratos, adendas y renovaciones históricas de un trabajador para visualización en su expediente/legajo digital.
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`, \`CONTADOR\`, \`ASISTENTE\`.`,
    }),
    ApiParam({
      name: 'empleadoId',
      type: 'string',
      format: 'uuid',
      description: 'UUID del empleado titular del expediente',
      example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    }),
    ApiContratoQuery(ListarContratosQuerySchema),

    ApiResponse({
      status: 200,
      description: 'Historial cronológico de contratos obtenido con éxito.',
    }),
    ApiResponse({ status: 400, description: 'UUID de empleado inválido.' }),
    ApiResponse({ status: 404, description: 'Empleado no encontrado o sin contratos registrados.' })
  );
}

/**
 * Documentación del endpoint POST /api/contrato/:id/subir-pdf
 */
export function ApiSwaggerSubirPdf() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiOperation({
      summary: 'Cargar PDF firmado del contrato (Bloqueo de Inmutabilidad)',
      description: `Carga el contrato físico escaneado con las firmas de ley.
        - **Bloqueo Inmutable**: Al completar la subida, el contrato pasa a ser estrictamente de solo lectura y ya no podrá ser editado ni alterado.
        - **Almacenamiento**: Se guarda en el volumen seguro persistente del servidor y se registra la ruta relativa.
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiParam({
      name: 'id',
      type: 'string',
      format: 'uuid',
      description: 'UUID del contrato a vincular',
      example: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
    }),
    ApiBody({
      description: 'Archivo PDF del contrato firmado por el trabajador y el representante legal',
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Archivo en formato PDF (application/pdf, máx 10 MB)',
          },
        },
      },
    }),
    ApiResponse({ status: 201, description: 'Documento PDF vinculado exitosamente y contrato bloqueado.' }),
    ApiResponse({ status: 400, description: 'Petición no multipart, formato distinto de PDF o archivo corrupto.' }),
    ApiResponse({ status: 404, description: 'El contrato no existe.' })
  );
}

/**
 * Documentación del endpoint GET /api/contrato/descargar/:filename
 */
export function ApiSwaggerDescargarPdf() {
  return applyDecorators(
    ApiOperation({
      summary: 'Descargar documento PDF del contrato',
      description: `Descarga el binario PDF en streaming desde el almacenamiento del servidor.
        - **Seguridad**: Aplica validación estricta de \`path.basename\` para evitar ataques de Path Traversal (\`../../\`).
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`, \`CONTADOR\`, \`EMPLEADO\`.`,
    }),
    ApiParam({
      name: 'filename',
      type: 'string',
      description: 'Nombre seguro del archivo físico generado en el servidor',
      example: 'contrato_a0eebc99_2026.pdf',
    }),
    ApiResponse({
      status: 200,
      description: 'Archivo binario del contrato retornado con cabecera application/pdf.',
      content: {
        'application/pdf': {
          schema: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Nombre de archivo inseguro o archivo inexistente en disco.' }),
    ApiResponse({ status: 401, description: 'No autenticado.' })
  );
}

export function ApiSwaggerListarContratosPorId() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener contrato por ID',
      description: `Recupera un contrato específico por su UUID.
        - **Roles Autorizados**: \`ADMIN\`, \`RRHH\`.`,
    }),
    ApiParam({
      name: 'id',
      type: 'string',
      format: 'uuid',
      description: 'UUID del contrato a consultar',
      example: 'c2eebc88-9c0b-4ef8-bb6d-8cc9bd380c33',
    }),
    ApiResponse({
      status: 200,
      description: 'Contrato obtenido exitosamente por su ID.',
    }),
    ApiResponse({ status: 400, description: 'UUID inválido.' }),
    ApiResponse({ status: 404, description: 'Contrato no encontrado.' })
  );
}