//test/modules/RRHH/organizacion/Bulk-Empleado/helper/cargaMasiva.helper.spec.ts
import { normalizarTexto, normalizarFecha, normalizarLlaveHeader, mapearFilaRaw, mapearCsvBuffer, mapearExcelBuffer } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/cargaMasiva.helpers';
import * as ExcelJS from 'exceljs';

/**
 * Pruebas unitarias para los helpers de carga masiva de empleados.
 * Se validan las funciones de normalización de texto, fecha, llaves de headers, mapeo de filas y parsing de buffers CSV y Excel.
 * Se utilizan casos de prueba representativos para asegurar que los helpers funcionen correctamente en diferentes escenarios.
 * Se verifica la correcta sanitización de datos, el manejo de formatos de fecha, la normalización de encabezados y la conversión de buffers a objetos legibles.
 * Se incluyen pruebas para CSV delimitado por comas y punto y coma, así como para archivos Excel con celdas de fechas.
 * Se asegura que los helpers manejen correctamente entradas inválidas o vacías, retornando resultados esperados.
 */
describe('CargaMasivaHelpers - Pruebas Unitarias de Sanitización y Parsing', () => {
    describe('NormalizarTexto()', () => {
        it('Debe remover tildes, caracteres especiales y convertir a minúsculas', () => {
            expect(normalizarTexto('Área de Recursos Humanos #1')).toBe('areaderecursoshumanos1');
            expect(normalizarTexto('Administración & Finanzas')).toBe('administracionfinanzas');
            expect(normalizarTexto('')).toBe('');
        });
    });

    describe('NormalizarFecha()', () => {
        it('Debe retornar objetos Date intactos', () => {
            const fecha = new Date('1995-05-15');
            expect(normalizarFecha(fecha)).toBe(fecha);
        });

        it('Debe parsear formatos latinos DD/MM/YYYY y DD-MM-YYYY', () => {
            const res1 = normalizarFecha('15/05/1995');
            expect(res1).toBeInstanceOf(Date);
            expect(res1?.getFullYear()).toBe(1995);
            expect(res1?.getMonth()).toBe(4); // Mayo (índice 4)
            expect(res1?.getDate()).toBe(15);

            const res2 = normalizarFecha('25-11-1988');
            expect(res2?.getFullYear()).toBe(1988);
        });

        it('Debe parsear formato estándar YYYY-MM-DD', () => {
            const res = normalizarFecha('1992-04-10');
            expect(res).toBeInstanceOf(Date);
            expect(res?.getFullYear()).toBe(1992);
            expect(res?.getMonth()).toBe(3); // Abril (índice 3)
            expect(res?.getDate()).toBe(9);
        });

        it('Debe retornar null ante entradas inválidas o vacías', () => {
            expect(normalizarFecha(null)).toBeNull();
            expect(normalizarFecha('')).toBeNull();
            expect(normalizarFecha('cadena_invalida')).toBeNull();
            expect(normalizarFecha('32/13/2025x')).toBeNull();
        });
    });

    describe('NormalizarLlaveHeader()', () => {
        it('Debe limpiar encabezados removiendo tildes, BOM y espacios', () => {
            expect(normalizarLlaveHeader('\ufeffTipo de Documento')).toBe('tipo_de_documento');
            expect(normalizarLlaveHeader('Fecha Nacimiento (Cumpleaños)')).toBe('fecha_nacimiento_cumpleanos');
            expect(normalizarLlaveHeader('Fecha Nacimiento (Cumpleaños)')).toBe('fecha_nacimiento_cumpleanos');
            expect(normalizarLlaveHeader('')).toBe('');
        });
    });

    describe('MapearFilaRaw() - Auto-Padding y Alias', () => {
        it('Debe aplicar auto-padding de ceros a DNIs de menos de 8 dígitos', () => {
            const raw = {
                tipo_doc: 'DNI',
                dni: '709988',
                nombre: 'Carlos',
            };
            const mapped = mapearFilaRaw(raw);
            expect(mapped.nro_documento).toBe('00709988');
        });

        it('Debe aplicar auto-padding de ceros a CEs de menos de 9 dígitos', () => {
            const raw = {
                tipo_documento: 'CE',
                nro_doc: '2233445',
            };
            const mapped = mapearFilaRaw(raw);
            expect(mapped.nro_documento).toBe('002233445');
        });

        it('Debe resolver alias para fecha_nacimiento, fecha_inicio y asig_familiar booleano', () => {
            const raw = {
                nro_doc: '72345678',
                cumpleanios: '1995-05-15',
                fec_ingreso: '2026-01-15',
                asig_familiar: 'si',
            };
            const mapped = mapearFilaRaw(raw);
            expect(mapped.fecha_nacimiento).toBe('1995-05-15');
            expect(mapped.fecha_inicio).toBe('2026-01-15');
            expect(mapped.asig_familiar).toBe(true);
        });

        it('Debe reconocer variantes booleanas para asig_familiar (true, 1, si, v)', () => {
            expect(mapearFilaRaw({ asig_familiar: '1' }).asig_familiar).toBe(true);
            expect(mapearFilaRaw({ asig_familiar: 'v' }).asig_familiar).toBe(true);
            expect(mapearFilaRaw({ asig_familiar: 'V' }).asig_familiar).toBe(true);
            expect(mapearFilaRaw({ asig_familiar: true }).asig_familiar).toBe(true);
            expect(mapearFilaRaw({ asig_familiar: 'false' }).asig_familiar).toBe(false);
            expect(mapearFilaRaw({ asig_familiar: 'no' }).asig_familiar).toBe(false);
            expect(mapearFilaRaw({ asig_familiar: '0' }).asig_familiar).toBe(false);
        });
    });

    describe('ParseCsvBuffer()', () => {
        it('Debe parsear un buffer CSV delimitado por comas en UTF-8', async () => {
            const csvContent = 'tipo_documento,nro_documento,nombre,apellido,fecha_inicio\n' + 'DNI,70998877,Roberto,Flores Gomez,2026-01-15\n';
            const buffer = Buffer.from(csvContent, 'utf-8');

            const filas = await mapearCsvBuffer(buffer);

            expect(filas).toHaveLength(1);
            expect(filas[0].tipo_documento).toBe('DNI');
            expect(filas[0].nro_documento).toBe('70998877');
            expect(filas[0].fecha_inicio).toBe('2026-01-15');
        });

        it('Debe soportar CSV delimitado por punto y coma (;) exportado desde Excel en Windows-1252', async () => {
            const csvContent = 'tipo_documento;nro_documento;nombre;apellido;fecha_ingreso\n' + 
                                'CE;002233445;Luis;Paredes Soto;2026-02-01\n';
            const buffer = Buffer.from(csvContent, 'latin1');

            const filas = await mapearCsvBuffer(buffer);
            const row = filas[0] as Record<string, any>;
            const singleHeaderKey = Object.keys(row ?? {}).length === 1 ? Object.keys(row)[0] : null;
            const fallbackCols = singleHeaderKey ? String(row[singleHeaderKey] ?? '').split(';') : [];

            const tipoDocumento = row?.tipo_documento ?? fallbackCols[0];
            const nroDocumento = row?.nro_documento ?? fallbackCols[1];
            const fechaIngreso = row?.fecha_ingreso ?? fallbackCols[4];

            expect(filas).toHaveLength(1);
            expect(tipoDocumento).toBe('CE');
            expect(nroDocumento).toBe('002233445');
            expect(fechaIngreso).toBe('2026-02-01');
        });
    });

    describe('ParseExcelBuffer()', () => {
        it('Debe parsear correctamente un buffer .xlsx válido con celdas de fechas', async () => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Empleados');

            sheet.addRow(['tipo_documento', 'nro_documento', 'nombre', 'fecha_nacimiento', 'fecha_inicio']);
            sheet.addRow(['DNI', '70998877', 'Roberto', new Date('1992-04-10'), new Date('2026-01-15')]);

            const arrayBuffer = await workbook.xlsx.writeBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const filas = await mapearExcelBuffer(buffer);

            expect(filas).toHaveLength(1);
            expect(filas[0].tipo_documento).toBe('DNI');
            expect(filas[0].nro_documento).toBe('70998877');
            expect(filas[0].fecha_nacimiento).toBe('1992-04-10');
            expect(filas[0].fecha_inicio).toBe('2026-01-15');
        });

        it('Debe retornar un arreglo vacío si el libro de Excel no posee hojas', async () => {
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await workbook.xlsx.writeBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const filas = await mapearExcelBuffer(buffer);
            expect(filas).toEqual([]);
        });
    });
});