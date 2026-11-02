//src/modules/asistencia/helpers/preparar-importacion.helper.ts
import type { PrismaService } from '@/common/prisma/prisma.service';
import type { MultipartFile } from '@fastify/multipart';
import { leerMarcacionesExcel } from './leer-marcaciones-excel.helper';

/**
 * Prepara la importación de marcaciones de asistencia desde un archivo Excel.
 * Este helper valida el archivo Excel, prepara los datos para la importación y devuelve un resumen de la vista de importación.
 * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
 * @param prisma - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 * @param archivo - El archivo Excel que contiene las marcaciones a importar.
 * @returns - Promesa que se resuelve con un objeto que contiene las filas de marcaciones, los empleados relacionados, 
 * un mapa por documento y un resumen de la vista de importación.
 * @throws - Error de tipo BadRequestException si el archivo Excel contiene errores o no se puede procesar.
 */
export async function prepararImportacion(prisma: PrismaService, archivo: MultipartFile) {
    //Se leen las marcaciones del archivo Excel y se obtienen las filas, errores, hash del archivo y período.
    const { filas, errores, archivoHash, periodo } = await leerMarcacionesExcel(archivo);
    const documentos = [...new Set(filas.map((f) => f.nro_documento))];

    //Se buscan los empleados en la base de datos que coincidan con los documentos de las filas y que estén vigentes (no eliminados).
    const empleados = await prisma.empleados.findMany({
        where: { nro_documento: { in: documentos }, deleted_at: null },
        select: { id: true, nro_documento: true, fecha_inicio: true, fecha_cese: true }
    });

    //Se crea un mapa de empleados por documento para facilitar la validación de las filas.
    const porDocumento = new Map(empleados.map((e) => [e.nro_documento, e]));

    //Se valida que cada fila corresponda a un vínculo laboral vigente en la fecha de la marcación.
    for (const f of filas) {
        const e = porDocumento.get(f.nro_documento);
        if (!e || !e.fecha_inicio || f.fecha < e.fecha_inicio.toISOString().slice(0, 10) || (e.fecha_cese && f.fecha > e.fecha_cese.toISOString().slice(0, 10))) {
            if (errores.length < 100)
                errores.push({ fila: f.fila, detalle: 'El documento no corresponde a un vínculo laboral vigente en esa fecha.' });
        }
    }
    
    //Se prepara la vista de importación con el hash del archivo, período, número de filas válidas y errores encontrados.
    const vista = { archivo_hash: archivoHash, periodo, filas_validas: filas.length, errores };
    return { filas, empleados, porDocumento, vista };
}

export type ImportacionPreparada = Awaited<ReturnType<typeof prepararImportacion>>;
