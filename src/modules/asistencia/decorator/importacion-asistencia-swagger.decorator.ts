//src/modules/asistencia/decorator/importacion-asistencia-swagger.decorator.ts
import {
  ApiErroresOperacion,
  ApiOperacionDocumentada,
} from '@/common/decorators/api-contrato.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { respuestaImportacion } from './asistencia-respuestas.swagger';

const roles = ['ADMIN', 'RRHH', 'ASISTENTE'];

export function ApiSwaggerImportacionAsistenciaController() {
  return applyDecorators(
    ApiTags('Asistencia - Importación biométrica'),
    ApiBearerAuth('JWT-auth'),
    ApiErroresOperacion()
  );
}

function ApiArchivoMarcaciones() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['archivo'],
        properties: {
          archivo: {
            type: 'string',
            format: 'binary',
            description:
              'Un solo XLSX de hasta 2 MB, una sola hoja, hasta 5000 filas y un único período.',
          },
        },
      },
    })
  );
}

export function ApiSwaggerValidarMarcacionesExcel() {
  return applyDecorators(
    ApiArchivoMarcaciones(),
    ApiOperacionDocumentada({
      summary: 'Validar Excel sin importar',
      description:
        'Revisa formato, cabeceras, fechas, vínculos laborales vigentes y límites; devuelve hasta cien errores. No guarda marcaciones.',
      roles,
      status: 201,
      respuesta: {
        ...respuestaImportacion,
        properties: {
          ...respuestaImportacion.properties,
          confirmable: { type: 'boolean' },
        },
      },
    })
  );
}

export function ApiSwaggerImportarMarcacionesExcel() {
  return applyDecorators(
    ApiArchivoMarcaciones(),
    ApiOperacionDocumentada({
      summary: 'Importar marcaciones de Excel',
      description:
        'Valida nuevamente el archivo y guarda todas las marcaciones válidas en una transacción (si hay errores responde 400 sin importar ninguna fila). Omite duplicados y rechaza con 409 períodos aprobados o con planilla cerrada.',
      roles,
      status: 201,
      respuesta: {
        ...respuestaImportacion,
        properties: {
          ...respuestaImportacion.properties,
          insertadas: { type: 'integer' },
          duplicadas_omitidas: { type: 'integer' },
        },
      },
    })
  );
}
