//src/modules/RRHH/organizacion/use-cases/carga-masiva/validarCargaMasiva.useCase.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { CargaMasivaFilaSchema } from '@jyp/shared-contracts';
import { Readable } from 'node:stream';
import { mapearFilaRaw, mapearCsvBuffer, mapearExcelBuffer } from './helpers/cargaMasiva.helpers';

/**
 * interfaz de error detectado en una fila durante la pre-validación de la carga masiva.
 */
export interface ErrorPreValidacionDetalle {
    fila: number; //Número de fila en el archivo (1-indexado)
    columna: string; //Nombre de la columna donde ocurrió el error
    valor_recibido: any; //Valor recibido en la fila
    mensaje: string; //Mensaje de error descriptivo
}

/**
 * Interfaz de resultado de la pre-validación de la carga masiva.
 */
export interface ReportePreValidacion {
    total_filas: number; //Número total de filas procesadas
    filas_validas: number; //Número de filas que pasaron la validación
    filas_invalidas: number; //Número de filas que fallaron la validación
    errores_detalle: ErrorPreValidacionDetalle[]; //Lista de errores detectados
    filas_validas_data: CargaMasivaFilaDTO[]; //Lista de filas válidas para procesamiento posterior
}

/**
 * Caso de uso para realizar la PRE-VALIDACIÓN (Dry Run) de un archivo Excel (.xlsx) o CSV.
 * - No efectúa escrituras en la base de datos.
 * - Detecta automáticamente codificaciones (UTF-8, Windows-1252) y formatos (.xlsx vs .csv).
 * - Sanitiza y mapea alias de columnas.
 * - Devuelve el reporte detallado con las filas listas para confirmar.
 */
@Injectable()
export class ValidarCargaMasivaUseCase {
    private readonly logger = new Logger(ValidarCargaMasivaUseCase.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta la pre-validación de un archivo de carga masiva.
     * @param filename - Nombre del archivo.
     * @param mimeType - Tipo MIME del archivo.
     * @param stream - Flujo de datos del archivo.
     * @returns Reporte de pre-validación.
     */
    async execute(filename: string, mimeType: string, stream: Readable): Promise<ReportePreValidacion> {
        this.logger.log(`Iniciando pre-validación de archivo masivo: ${filename} (${mimeType})...`);

        const bufferCompleto = await this.leerBuffer(stream);
        const filasSanitizadasRaw = await this.mapearArchivo(filename, mimeType, bufferCompleto);

        if (filasSanitizadasRaw.length === 0) throw new BadRequestException('No se encontraron registros de datos en la hoja del archivo.');

        const { errores, filasValidas } = this.validarFilas(filasSanitizadasRaw);

        return {
            total_filas: filasSanitizadasRaw.length,
            filas_validas: filasValidas.length,
            filas_invalidas: errores.length,
            errores_detalle: errores,
            filas_validas_data: filasValidas
        };
    }

    /**
     * metodo auxiliar para leer el buffer completo de un stream.
     * @param stream - El stream del cual leer el buffer.
     * @returns Una promesa que se resuelve con el buffer completo.
     */
    private async leerBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for await (const chunk of stream)
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

        const bufferCompleto = Buffer.concat(chunks);
        if (bufferCompleto.length === 0) throw new BadRequestException('El archivo está vacío.');

        return bufferCompleto;
    }

    /**
     * metodo para mapear y parsear un archivo de carga masiva.
     * @param filename - Nombre del archivo.
     * @param mimeType - Tipo MIME del archivo.
     * @param bufferCompleto - Buffer completo del archivo.
     * @returns Una promesa que se resuelve con un arreglo de objetos representando las filas del archivo.
     */
    private async mapearArchivo(filename: string, mimeType: string, bufferCompleto: Buffer): Promise<Record<string, any>[]> {
        const esExcel = filename.toLowerCase().endsWith('.xlsx') || mimeType.includes('spreadsheetml') || mimeType.includes('excel');

        if (esExcel) return mapearExcelBuffer(bufferCompleto);

        return mapearCsvBuffer(bufferCompleto);
    }

    /**
     * metodo para validar las filas de un archivo de carga masiva.
     * @param filasSanitizadasRaw - Arreglo de objetos representando las filas del archivo.
     * @returns Un objeto con los errores encontrados y las filas válidas.
     */
    private validarFilas(filasSanitizadasRaw: Record<string, any>[]): { errores: ErrorPreValidacionDetalle[]; filasValidas: CargaMasivaFilaDTO[] } {
        const errores: ErrorPreValidacionDetalle[] = [];
        const filasValidas: CargaMasivaFilaDTO[] = [];
        let numeroFila = 1;

        //Iterar sobre cada fila del archivo y validar según el esquema definido
        for (const filaRaw of filasSanitizadasRaw) {
            numeroFila++;

            const objetoEstandar = mapearFilaRaw(filaRaw);
            if (!objetoEstandar.nro_documento) {
                errores.push({
                    fila: numeroFila,
                    columna: 'nro_documento',
                    valor_recibido: objetoEstandar.nro_documento,
                    mensaje: 'El número de documento es obligatorio.'
                });
                continue;
            }

            const validacion = CargaMasivaFilaSchema.safeParse(objetoEstandar);
            if (validacion.success) {
                filasValidas.push(validacion.data);
                continue;
            }

            this.agregarErroresFila(validacion.error.issues, objetoEstandar, numeroFila, errores);
        }

        return { errores, filasValidas };
    }

    /**
     * metodo para agregar errores de validación de una fila.
     * @param issues - Arreglo de errores de validación.
     * @param objetoEstandar - Objeto con los datos de la fila.
     * @param numeroFila - Número de la fila.
     * @param errores - Arreglo de errores pre-validación.
     */
    private agregarErroresFila(issues: { path: (string | number)[]; message: string }[],
        objetoEstandar: Record<string, any>,
        numeroFila: number,
        errores: ErrorPreValidacionDetalle[]
    ): void {
        //Iterar sobre cada issue de validación y agregarlo al arreglo de errores
        for (const issue of issues) {
            const columna = issue.path.length > 0 ? issue.path.join('.') : 'general';
            const valorRecibido = issue.path.length > 0 ? (objetoEstandar as any)[issue.path[0] as string] : undefined;

            errores.push({
                fila: numeroFila,
                columna,
                valor_recibido: valorRecibido,
                mensaje: issue.message
            });
        }
    }
}