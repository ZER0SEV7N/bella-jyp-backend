import { ApiErroresOperacion, ApiOperacionDocumentada } from '@/common/decorators/api-contrato.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { respuestaImportacion } from './asistencia-respuestas.swagger';

const roles = ['ADMIN', 'RRHH', 'ASISTENTE'];
const formato = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function ApiSwaggerImportacionAsistenciaController() {
    return applyDecorators(ApiTags('Asistencia - Importación biométrica'), ApiBearerAuth('JWT-auth'), ApiErroresOperacion());
}

function ApiArchivoMarcaciones() {
    return applyDecorators(
        ApiConsumes('multipart/form-data'),
        ApiBody({
            schema: {
                type: 'object',
                required: ['archivo'],
                properties: { archivo: { type: 'string', format: 'binary', description: 'Un solo XLSX de hasta 2 MB, 5000 filas y un período.' } }
            }
        })
    );
}
export function ApiSwaggerValidarMarcacionesExcel() {
    return applyDecorators(
        ApiArchivoMarcaciones(),
        ApiOperacionDocumentada({
            summary: 'Validar Excel sin importar',
            description: 'Revisa formato, fechas, vínculos y límites; devuelve hasta cien errores. No guarda marcaciones.',
            roles,
            status: 201,
            respuesta: { ...respuestaImportacion, properties: { ...respuestaImportacion.properties, confirmable: { type: 'boolean' } } }
        })
    );
}
export function ApiSwaggerImportarMarcacionesExcel() {
    return applyDecorators(
        ApiArchivoMarcaciones(),
        ApiOperacionDocumentada({
            summary: 'Importar marcaciones de Excel',
            description: 'Valida nuevamente y guarda todo el archivo en una transacción. Omite duplicados y rechaza cambios en fuentes aprobadas o congeladas.',
            roles,
            status: 201,
            respuesta: {
                ...respuestaImportacion,
                properties: { ...respuestaImportacion.properties, insertadas: { type: 'integer' }, duplicadas_omitidas: { type: 'integer' } }
            }
        })
    );
}
