import * as ExcelJS from 'exceljs';
import type { CargaMasivaAsistenciaFileDto } from '@jyp/shared-contracts';
import { CargaMasivaAsistenciaFileSchema } from '@jyp/shared-contracts';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PrismaService } from '@/common/prisma/prisma.service';

dayjs.extend(utc);
dayjs.extend(timezone);

export const PERU_TIMEZONE = 'America/Lima';

export function obtenerMes(): string {
    return dayjs().tz(PERU_TIMEZONE).format('YYYY-MM-DD');
}

export interface FilaConError {
    fila: number;
    error: string;
}

export interface ResultadoLectura {
    filasValidas: CargaMasivaAsistenciaFileDto[];
    filasConError: FilaConError[];
}

const COL = {
    DOCUMENTO: 2,
    NOMBRE: 3,
    APELLIDO: 4,
    ENTRADA_1: 5,
    SALIDA_1: 6,
    ENTRADA_2: 7,
    SALIDA_2: 8,
};

export function valorAString(cell: ExcelJS.Cell): string {
    const valor = cell.value;
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) {
        return dayjs.utc(valor).format('HH:mm');
    }
    return String(valor).trim();
} 

export async function leerArchivoExcel(buffer: Buffer): Promise<ResultadoLectura> {
    
    const csv = new ExcelJS.Workbook();
    await csv.xlsx.load(buffer as any);
    
    const hoja = csv.worksheets[0];
    if (!hoja) {
        throw new Error('El archivo no contiene hojas');
    }

    const filasValidas: CargaMasivaAsistenciaFileDto[] = [];
    const filasConError: FilaConError[] = [];

    hoja.eachRow({ includeEmpty: false }, (row, nroFila) => {
        if (nroFila === 1) return;

        const documento = valorAString(row.getCell(COL.DOCUMENTO));
        if (!documento) return;

        const asistencias = {
            documento,
            horaEntrada1: valorAString(row.getCell(COL.ENTRADA_1)) || undefined,
            horaSalida1: valorAString(row.getCell(COL.SALIDA_1)) || undefined,
            horaEntrada2: valorAString(row.getCell(COL.ENTRADA_2)) || undefined,
            horaSalida2: valorAString(row.getCell(COL.SALIDA_2)) || undefined,
        };

        const resultado = CargaMasivaAsistenciaFileSchema.safeParse(asistencias);
        if (resultado.success) {
            filasValidas.push(resultado.data);
        } else {
            filasConError.push({
                fila: nroFila,
                error: resultado.error.issues.map((i) => i.message).join(', '),
            });
        }
    });

    return { filasValidas, filasConError };
}

export function separarHoras(fila: CargaMasivaAsistenciaFileDto): { tipo: 'ENTRADA' | 'SALIDA', horaStr: string }[] {
    const marcaciones: { tipo: 'ENTRADA' | 'SALIDA', horaStr: string }[] = [];
    
    if (fila.horaEntrada1) marcaciones.push({ tipo: 'ENTRADA', horaStr: fila.horaEntrada1 });
    if (fila.horaSalida1) marcaciones.push({ tipo: 'SALIDA', horaStr: fila.horaSalida1 });
    if (fila.horaEntrada2) marcaciones.push({ tipo: 'ENTRADA', horaStr: fila.horaEntrada2 });
    if (fila.horaSalida2) marcaciones.push({ tipo: 'SALIDA', horaStr: fila.horaSalida2 });
    
    return marcaciones;
}

export async function obtenerColaboradores(prisma:PrismaService,documentos: string[]) {
    return await prisma.empleados.findMany({
        where: {
            nro_documento: { in: documentos },
            activo: true,
            deleted_at: null,
        },
        select: {
            id: true,
            nro_documento: true,
        }
    });
}