import { applyDecorators } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiBody, ApiExtension } from '@nestjs/swagger';

/**
 * Decorador de nivel controlador para agrupar las operaciones de carga masiva en dos pasos (Two-Step Staging Ingestion).
 */
export function ApiSwaggerEmpleadosBulkController() {
  return applyDecorators(
    ApiTags('RRHH - Carga Masiva de Empleados (Two-Step Ingestion)'),
    ApiBearerAuth('JWT-auth'),
    ApiExtension('x-roles', ['ADMIN', 'RRHH']),
  );
}

/**
 * Documentación del endpoint POST /api/rrhh/empleados/bulk/validar (Paso 1: Dry Run)
 */
export function ApiSwaggerValidateBulk() {
  return applyDecorators(
    ApiOperation({
      summary: 'Paso 1: Pre-validar archivo de empleados (Dry Run en Staging)',
      description: `
Examina y sanitiza un archivo Excel (\`.xlsx\`) o CSV (\`.csv\`) sin realizar mutaciones ni escrituras en la base de datos:
1. **Normalización**: Limpia espacios en blanco, estandariza formatos de fechas (ISO YYYY-MM-DD), sexo y estado civil.
2. **Cruce de Catálogos**: Valida la existencia de Áreas, Cargos, Jornadas, Bancos y AFPs contra la base de datos/Redis.
3. **Validación Zod**: Evalúa cada registro contra \`CargaMasivaFilaSchema\`.
4. **Reporte**: Retorna los conteos globales (\`total_filas\`, \`filas_validas\`, \`filas_invalidas\`) junto al detalle celda por celda de los errores detectados para su previsualización en la tabla interactiva de Staging en el frontend.`,
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description: 'Archivo digital que contiene el legajo masivo de personal',
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Libro de Excel (.xlsx) o archivo delimitado por comas (.csv)',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Reporte de pre-visualización generado exitosamente.',
      schema: {
        example: {
          type: 'https://api.jyp.com/bulk/pre-validation',
          title: 'Reporte de Pre-Visualización',
          status: 200,
          data: {
            total_filas: 50,
            filas_validas_count: 48,
            filas_invalidas_count: 2,
            filas_validas: [
              {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                nombre: 'Daniel Enrique',
                apellido: 'Singer Rojas',
                sexo: 'MASCULINO',
                estado_civil: 'SOLTERO',
                fecha_nacimiento: '2000-05-14',
                email: 'dsinger@empresa.com',
                telefono: '987654321',
                direccion: 'Av. Javier Prado Este 2450',
                departamento: 'LIMA',
                provincia: 'LIMA',
                distrito: 'SAN BORJA',
                ubigeo: '150130',
                fecha_inicio: '2026-10-01',
                asig_familiar: false,
                area: 'Tecnología de la Información',
                cargo: 'Backend Lead',
                jornada: 'Turno Completo (Oficina)',
                sueldo_basico: 3500.0,
                regimen_pension: 'AFP',
                tipo_afp: 'INTEGRA',
                cuspp: '112233ABCDE4',
                tipo_comision: 'MIXTA',
                banco_sueldo: 'BCP',
                tipo_cuenta_sueldo: 'SUELDO',
                nro_cuenta_sueldo: '19198765432012',
                cci_sueldo: '00219100987654320124',
                banco_cts: 'INTERBANK',
                tipo_cuenta_cts: 'AHORROS',
                nro_cuenta_cts: '19199887766055',
                cci_cts: '00219100998877660551',
                regimen_salud: 'ESSALUD_REGULAR',
                eps_costo_adicional: 0,
              },
            ],
            errores: [
              {
                fila: 14,
                nro_documento: '445566',
                campo: 'nro_documento',
                mensaje: 'El número de documento debe tener al menos 8 caracteres',
              },
            ],
          },
          timestamp: '2026-09-24T18:00:00.000Z',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Archivo vacío, formato distinto a .xlsx/.csv o estructura de cabeceras ilegible.' }),
    ApiResponse({ status: 401, description: 'No autenticado.' }),
    ApiResponse({ status: 403, description: 'Acceso denegado: Se requiere rol ADMIN o RRHH.' }),
  );
}

/**
 * Documentación del endpoint POST /api/rrhh/empleados/bulk/confirmar (Paso 2: Encolamiento Asíncrono)
 */
export function ApiSwaggerConfirmBulk() {
  return applyDecorators(
    ApiOperation({
      summary: 'Paso 2: Confirmar e ingestar filas limpias en segundo plano',
      description: `
Recibe la carga aprobada de filas limpias desde la interfaz de Staging:
1. Registra la orden de trabajo (\`Job\`) en la base de datos con estado \`EN_COLA\`.
2. Segmenta la colección en lotes de 50 registros para evitar el agotamiento de memoria del hilo de Node.js.
3. Despacha los trabajos a la cola de **BullMQ + Redis**.
4. Retorna el identificador unívoco \`jobId\` con código **202 Accepted** para habilitar el seguimiento por polling o WebSocket.`,
    }),
    ApiBody({
      description: 'Cuerpo con la lista de filas limpias validadas listas para persistencia definitiva',
      schema: {
        type: 'object',
        required: ['filas_validas_data'],
        properties: {
          filas_validas_data: {
            type: 'array',
            description: 'Colección de empleados conformes con CargaMasivaFilaSchema',
            items: {
              type: 'object',
              required: [
                'tipo_documento',
                'nro_documento',
                'sexo',
                'fecha_nacimiento',
                'direccion',
                'departamento',
                'provincia',
                'distrito',
                'fecha_inicio',
                'area',
                'cargo',
              ],
              properties: {
                tipo_documento: { type: 'string', enum: ['DNI', 'CE', 'PASAPORTE', 'PTP'], example: 'DNI' },
                nro_documento: { type: 'string', minLength: 8, maxLength: 20, example: '72345678' },
                nombre: { type: 'string', example: 'Daniel Enrique', nullable: true },
                apellido: { type: 'string', example: 'Singer Rojas', nullable: true },
                sexo: { type: 'string', enum: ['MASCULINO', 'FEMENINO'], example: 'MASCULINO' },
                estado_civil: { type: 'string', enum: ['SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO'], example: 'SOLTERO' },
                fecha_nacimiento: { type: 'string', format: 'date', example: '2000-05-14' },
                email: { type: 'string', format: 'email', example: 'dsinger@empresa.com', nullable: true },
                telefono: { type: 'string', example: '987654321', nullable: true },
                direccion: { type: 'string', example: 'Av. Javier Prado Este 2450' },
                departamento: { type: 'string', example: 'LIMA' },
                provincia: { type: 'string', example: 'LIMA' },
                distrito: { type: 'string', example: 'SAN BORJA' },
                ubigeo: { type: 'string', example: '150130', nullable: true },
                fecha_inicio: { type: 'string', format: 'date', example: '2026-10-01' },
                asig_familiar: { type: 'boolean', example: false, default: false },
                area: { type: 'string', example: 'Tecnología de la Información' },
                cargo: { type: 'string', example: 'Backend Lead' },
                jornada: { type: 'string', example: 'Turno Completo (Oficina)', nullable: true },
                sueldo_basico: { type: 'number', example: 3500.0, default: 1130.0 },
                regimen_pension: { type: 'string', enum: ['ONP', 'AFP'], example: 'AFP' },
                tipo_afp: { type: 'string', enum: ['INTEGRA', 'PRIMA', 'HABITAT', 'PROFUTURO'], example: 'INTEGRA', nullable: true },
                cuspp: { type: 'string', example: '112233ABCDE4', nullable: true },
                tipo_comision: { type: 'string', enum: ['FLUJO', 'MIXTA'], example: 'MIXTA', nullable: true },
                banco_sueldo: { type: 'string', example: 'BCP', nullable: true },
                tipo_cuenta_sueldo: { type: 'string', enum: ['SUELDO', 'AHORROS', 'CORRIENTE'], example: 'SUELDO' },
                nro_cuenta_sueldo: { type: 'string', example: '19198765432012', nullable: true },
                cci_sueldo: { type: 'string', example: '00219100987654320124', nullable: true },
                banco_cts: { type: 'string', example: 'INTERBANK', nullable: true },
                tipo_cuenta_cts: { type: 'string', enum: ['AHORROS', 'CORRIENTE'], example: 'AHORROS' },
                nro_cuenta_cts: { type: 'string', example: '19199887766055', nullable: true },
                cci_cts: { type: 'string', example: '00219100998877660551', nullable: true },
                regimen_salud: { type: 'string', enum: ['ESSALUD_REGULAR', 'EPS', 'ESSALUD_Y_EPS', 'SCTR'], example: 'ESSALUD_REGULAR' },
                eps_costo_adicional: { type: 'number', example: 0, default: 0 },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 202,
      description: 'Lotes de empleados confirmados y encolados en BullMQ exitosamente.',
      schema: {
        example: {
          type: 'https://api.jyp.com/jobs/accepted',
          title: 'Procesamiento en Cola',
          status: 202,
          detail: 'Las filas válidas confirmadas han sido encoladas para procesamiento en segundo plano.',
          jobId: 'f72a4ebd-6e4d-4a11-bb6d-8cc9bd380c33',
          timestamp: '2026-09-24T18:02:00.000Z',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Arreglo filas_validas_data ausente o vacío.' }),
    ApiResponse({ status: 401, description: 'No autenticado.' }),
    ApiResponse({ status: 403, description: 'Acceso denegado.' }),
  );
}

/**
 * Documentación del endpoint GET /api/rrhh/empleados/bulk/:jobId (Polling de Progreso)
 */
export function ApiSwaggerGetBulkStatus() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consultar estado y métricas de avance de la carga masiva',
      description: `
Permite supervisar la ejecución asíncrona procesada por el worker de BullMQ:
- **Estados posibles**: \`EN_COLA\`, \`PROCESANDO\`, \`COMPLETADO\`, \`FALLIDO\`.
- **Métricas**: Retorna el porcentaje de avance, filas procesadas, errores y tiempo de ejecución.`,
    }),
    ApiParam({
      name: 'jobId',
      description: 'UUID del trabajo devuelto al confirmar la ingesta',
      required: true,
      example: 'f72a4ebd-6e4d-4a11-bb6d-8cc9bd380c33',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiResponse({
      status: 200,
      description: 'Estado de procesamiento recuperado.',
      schema: {
        example: {
          data: {
            jobId: 'f72a4ebd-6e4d-4a11-bb6d-8cc9bd380c33',
            estado: 'PROCESANDO',
            porcentaje: 65,
            total_registros: 100,
            procesados: 65,
            fallidos: 2,
            errores: [
              {
                fila: 12,
                nro_documento: '71122334',
                error: 'El cargo "Arquitecto Cloud" no existe en la base de datos.',
              },
            ],
          },
          timestamp: '2026-09-24T18:03:00.000Z',
        },
      },
    }),
    ApiResponse({ status: 400, description: 'Identificador jobId con formato inválido.' }),
    ApiResponse({ status: 404, description: 'El trabajo no existe o pertenece a otro usuario.' }),
  );
}

/**
 * Documentación del endpoint GET /api/rrhh/empleados/bulk/plantilla (Descarga de Excel Oficial)
 */
export function ApiSwaggerDownloadTemplate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Descargar plantilla oficial de carga masiva en Excel (.xlsx)',
      description: `
Descarga el libro oficial generado con ExcelJS:
- Contiene los 28 encabezados estándar requeridos por el pipeline de ingesta.
- Incluye validaciones de datos nativas de Excel (listas desplegables para Sexo, Estado Civil, Departamentos, Régimen de Salud, AFPs y Comisiones).
- Incorpora filas de ejemplo con datos válidos para guiar al usuario de RRHH.`,
    }),
    ApiResponse({
      status: 200,
      description: 'Libro de Excel descargado con éxito.',
      content: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
          schema: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
    ApiResponse({ status: 401, description: 'No autenticado.' }),
    ApiResponse({ status: 403, description: 'Acceso denegado.' }),
  );
}