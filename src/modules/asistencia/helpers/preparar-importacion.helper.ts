import type { PrismaService } from '@/common/prisma/prisma.service';
import type { MultipartFile } from '@fastify/multipart';
import { leerMarcacionesExcel } from './leer-marcaciones-excel.helper';

/** Verifica el vínculo en la fecha de cada marca, incluso si el empleado ya está cesado. */
export async function prepararImportacion(prisma: PrismaService, archivo: MultipartFile) {
    const { filas, errores, archivoHash, periodo } = await leerMarcacionesExcel(archivo);
    const documentos = [...new Set(filas.map((f) => f.nro_documento))];
    const empleados = await prisma.empleados.findMany({
        where: { nro_documento: { in: documentos }, deleted_at: null },
        select: { id: true, nro_documento: true, fecha_inicio: true, fecha_cese: true }
    });
    const porDocumento = new Map(empleados.map((e) => [e.nro_documento, e]));
    for (const f of filas) {
        const e = porDocumento.get(f.nro_documento);
        if (!e || !e.fecha_inicio || f.fecha < e.fecha_inicio.toISOString().slice(0, 10) || (e.fecha_cese && f.fecha > e.fecha_cese.toISOString().slice(0, 10)))
            if (errores.length < 100) errores.push({ fila: f.fila, detalle: 'El documento no corresponde a un vínculo laboral vigente en esa fecha.' });
    }
    const vista = { archivo_hash: archivoHash, periodo, filas_validas: filas.length, errores };
    return { filas, empleados, porDocumento, vista };
}

export type ImportacionPreparada = Awaited<ReturnType<typeof prepararImportacion>>;
