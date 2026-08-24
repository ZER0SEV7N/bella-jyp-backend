//src/modules/RRHH/organizacion/use-cases/carga-masiva/validarCargaMasiva.useCase.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { CargaMasivaFilaSchema } from '@jyp/shared-contracts';
import { Readable } from 'node:stream';
import { MapearFilaRaw, NormalizarLlaveHeader, ParseCsvBuffer, ParseExcelBuffer } from './helpers/cargaMasiva.helpers';

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

        //Leer todo el stream en un Buffer para soportar parseo ExcelJs y fallback a csv-parser
        const chunks: Buffer[] = [];
        for await (const chunk of stream) 
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            
        const bufferCompleto = Buffer.concat(chunks);
        if(bufferCompleto.length === 0) throw new BadRequestException('El archivo está vacío.');

        //Detectar si el archivo es Excel (.xlsx) o CSV basado en extensión y tipo MIME
        const esExcel = filename.toLowerCase().endsWith('.xlsx') || mimeType.includes('spreadsheetml') || mimeType.includes('excel');
        let filasSanitizadasRaw: Record<string, any>[] = [];

        if (esExcel) 
        filasSanitizadasRaw = await ParseExcelBuffer(bufferCompleto);
        else 
        filasSanitizadasRaw = await ParseCsvBuffer(bufferCompleto);
        
        if (filasSanitizadasRaw.length === 0) throw new BadRequestException('No se encontraron registros de datos en la hoja del archivo.');
    
        //Procesar y validar cada fila usando Zod
        const errores: ErrorPreValidacionDetalle[] = [];
        const filasValidas: CargaMasivaFilaDTO[] = [];

        //Iterar sobre cada fila y validar usando Zod
        let numeroFila = 1;

        //Iterar sobre cada fila y validar usando Zod
        for (const filaRaw of filasSanitizadasRaw) {
            numeroFila++;

            //Mapear la fila cruda a la estructura estándar de CargaMasivaFilaDTO
            const objetoEstandar = MapearFilaRaw(filaRaw);

            //Validar que el número de documento no esté vacío
            if (!objetoEstandar.nro_documento) {
                errores.push({
                    fila: numeroFila,
                    columna: 'nro_documento',
                    valor_recibido: objetoEstandar.nro_documento,
                    mensaje: 'El número de documento es obligatorio.'
                });
                continue;
            }

            //Corroborar que el tipo de documento exista en la base de datos
            const validacion = CargaMasivaFilaSchema.safeParse(objetoEstandar);

            //Si la validación falla, registrar los errores detallados
            if (!validacion.success) 
                for (const issue of validacion.error.issues) 
                    errores.push({
                        fila: numeroFila,
                        columna: issue.path.join('.') || 'general',
                        valor_recibido: (objetoEstandar as any)[issue.path[0] as string],
                        mensaje: issue.message
                    });
                
            else 
                filasValidas.push(validacion.data);
            
        }

        return {
            total_filas: filasSanitizadasRaw.length,
            filas_validas: filasValidas.length,
            filas_invalidas: errores.length,
            errores_detalle: errores,
            filas_validas_data: filasValidas
        };
    }
}