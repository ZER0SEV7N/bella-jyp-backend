// test/modules/asistencia/helpers/asistencia-helpers.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { conArchivoBiometrico } from '@/modules/asistencia/helpers/archivo-biometrico.helper';
import { cargarContextoAsistencia, huellaAsistencia } from '@/modules/asistencia/helpers/asistencia-contexto.helper';
import { fechaExcel, horaExcel, validarFilaMarcacion } from '@/modules/asistencia/helpers/fila-marcacion-excel.helper';
import { leerMarcacionesExcel } from '@/modules/asistencia/helpers/leer-marcaciones-excel.helper';
import { validarPeriodoEditable } from '@/modules/asistencia/helpers/periodo-editable.helper';
import { prepararImportacion } from '@/modules/asistencia/helpers/preparar-importacion.helper';
import { obtenerColaborador, validarExistencia } from '@/modules/asistencia/helpers/procesarAsistenciaWeb.helper';
import type { MultipartFile } from '@fastify/multipart';

/**
 * Construye un MultipartFile simulado en memoria a partir de un Buffer XLSX.
 */
function crearMultipartBuffer(buffer: Buffer, truncated = false): MultipartFile {
  const stream = Readable.from(buffer) as Readable & { truncated: boolean };
  stream.truncated = truncated;
  return {
    file: stream,
    filename: 'marcaciones.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as MultipartFile;
}

/**
 * Genera un libro Excel real en memoria con las filas especificadas.
 */
async function crearExcelBuffer(filas: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Marcaciones');
  for (const fila of filas) {
    ws.addRow(fila);
  }
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('Helpers del Módulo de Asistencia', () => {
  describe('fila-marcacion-excel.helper.ts', () => {
    it('debería convertir fechas seriales de Excel (sistemas 1900 y 1904) y horas fraccionarias', () => {
      // Arrange & Act & Assert
      expect(fechaExcel(46300, false)).toBe('2026-10-05');
      expect(fechaExcel(30, false)).toBe('1900-01-30');
      expect(fechaExcel(10, true)).toBe('1904-01-11');
      expect(() => fechaExcel(60, false)).toThrow(BadRequestException);
      expect(() => fechaExcel(-1, true)).toThrow(BadRequestException);

      expect(horaExcel(0.5)).toBe('12:00:00');
      expect(() => horaExcel(-0.1)).toThrow(BadRequestException);
      expect(() => horaExcel(1)).toThrow(BadRequestException);
    });

    it('debería validar una fila de marcación biométrica y rechazar documentos numéricos o fechas futuras', () => {
      // Arrange
      const filaValida = {
        number: 2,
        values: [undefined, '72345678', '2026-05-10', '08:00:00', 'entrada'],
      } as unknown as ExcelJS.Row;
      const filaDocNumerico = {
        number: 3,
        values: [undefined, 72345678, '2026-05-10', '08:00:00', 'ENTRADA'],
      } as unknown as ExcelJS.Row;
      const filaFutura = {
        number: 4,
        values: [undefined, '72345678', '2099-05-10', '08:00:00', 'ENTRADA'],
      } as unknown as ExcelJS.Row;

      // Act
      const resultado = validarFilaMarcacion(filaValida, false);

      // Assert
      expect(resultado).toEqual({
        nro_documento: '72345678',
        fecha: '2026-05-10',
        hora: '08:00:00',
        tipo_marcacion: 'ENTRADA',
        fila: 2,
      });
      expect(() => validarFilaMarcacion(filaDocNumerico, false)).toThrow(BadRequestException);
      expect(() => validarFilaMarcacion(filaFutura, false)).toThrow(BadRequestException);
    });
  });

  describe('archivo-biometrico.helper.ts, leer-marcaciones-excel.helper.ts y preparar-importacion.helper.ts', () => {
    it('debería leer y preparar un archivo Excel válido de marcaciones biométricas e identificar vínculos no vigentes', async () => {
      // Arrange
      const buffer = await crearExcelBuffer([
        ['nro_documento', 'fecha', 'hora', 'tipo_marcacion'],
        ['72345678', '2026-05-10', '08:00:00', 'ENTRADA'],
        ['99999999', '2026-05-10', '08:05:00', 'ENTRADA'],
      ]);
      const prismaMock = {
        empleados: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'emp-1',
              nro_documento: '72345678',
              fecha_inicio: new Date('2026-01-01T00:00:00.000Z'),
              fecha_cese: null,
            },
          ]),
        },
      } as any;

      // Act
      const preparada = await prepararImportacion(prismaMock, crearMultipartBuffer(buffer));

      // Assert
      expect(preparada.filas).toHaveLength(2);
      expect(preparada.vista.periodo).toBe('2026-05');
      expect(preparada.vista.errores).toHaveLength(1);
      expect(preparada.vista.errores[0].fila).toBe(3);
    });

    it('debería rechazar archivos que no son ZIP/XLSX válidos o tienen cabeceras incorrectas', async () => {
      // Arrange
      const bufferInvalido = Buffer.from('contenido-no-zip');
      const bufferCabeceraErronea = await crearExcelBuffer([
        ['dni', 'fecha', 'hora', 'tipo'],
        ['72345678', '2026-05-10', '08:00:00', 'ENTRADA'],
      ]);

      // Act & Assert
      await expect(conArchivoBiometrico(crearMultipartBuffer(bufferInvalido), async () => true)).rejects.toThrow(/FILE_ENDED/);
      await expect(leerMarcacionesExcel(crearMultipartBuffer(bufferCabeceraErronea))).rejects.toThrow(BadRequestException);
    });
  });

  describe('asistencia-contexto.helper.ts', () => {
    it('debería cargar el contexto completo de asistencia y generar su huella SHA-256 determinista', async () => {
      // Arrange
      const txMock = {
        empleados: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'emp-1',
            fecha_inicio: new Date('2026-01-01T00:00:00.000Z'),
            fecha_cese: null,
            deleted_at: null,
          }),
        },
        asistencia_marcacion: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'm-1',
              fecha_hora: new Date('2026-10-05T13:00:00.000Z'),
              tipo_marcacion: 'ENTRADA',
              metodo: 'MANUAL',
            },
          ]),
        },
        solicitud: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        asistencia_jornada: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        asistencia_decision: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        asistencia_calendario: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as any;

      // Act
      const contexto = await cargarContextoAsistencia(txMock, 'emp-1', '2026-10', new Date('2026-10-31T12:00:00.000Z'));
      const hash = huellaAsistencia(contexto);

      // Assert
      expect(contexto.empleado.id).toBe('emp-1');
      expect(contexto.marcaciones).toHaveLength(1);
      expect(hash).toHaveLength(64);
    });

    it('debería lanzar NotFoundException o BadRequestException si el colaborador no existe o carece de fecha de ingreso', async () => {
      // Arrange
      const txNoExiste = { empleados: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
      const txSinIngreso = {
        empleados: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', fecha_inicio: null, deleted_at: null }) },
      } as any;

      // Act & Assert
      await expect(cargarContextoAsistencia(txNoExiste, 'emp-1', '2026-10', new Date())).rejects.toThrow(NotFoundException);
      await expect(cargarContextoAsistencia(txSinIngreso, 'emp-1', '2026-10', new Date())).rejects.toThrow(BadRequestException);
    });
  });

  describe('periodo-editable.helper.ts y procesarAsistenciaWeb.helper.ts', () => {
    it('debería validar períodos editables y rechazar planillas cerradas o incidencias aprobadas', async () => {
      // Arrange
      const txAbierto = {
        historial_planillas: { findUnique: jest.fn().mockResolvedValue({ estado: 'ABIERTO' }) },
        incidencias_mes: { findUnique: jest.fn().mockResolvedValue({ estado: 'PENDIENTE' }) },
      } as any;
      const txPlanillaCongelada = {
        historial_planillas: { findUnique: jest.fn().mockResolvedValue({ estado: 'CONGELADO' }) },
        incidencias_mes: { findUnique: jest.fn() },
      } as any;
      const txIncidenciaAprobada = {
        historial_planillas: { findUnique: jest.fn().mockResolvedValue(null) },
        incidencias_mes: { findUnique: jest.fn().mockResolvedValue({ estado: 'APROBADO' }) },
      } as any;

      // Act & Assert
      await expect(validarPeriodoEditable(txAbierto, 'emp-1', '2026-10')).resolves.toBeUndefined();
      await expect(validarPeriodoEditable(txPlanillaCongelada, 'emp-1', '2026-10')).rejects.toThrow(ConflictException);
      await expect(validarPeriodoEditable(txIncidenciaAprobada, 'emp-1', '2026-10')).rejects.toThrow(ConflictException);
      await expect(validarPeriodoEditable(txIncidenciaAprobada, 'emp-1', '2026-10', true)).resolves.toBeUndefined();
    });

    it('debería obtener un colaborador con vínculo vigente y verificar la existencia de marcaciones', async () => {
      // Arrange
      const prismaMock = {
        empleados: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'emp-1',
              fecha_inicio: new Date('2026-01-01T00:00:00.000Z'),
              fecha_cese: null,
            })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              id: 'emp-1',
              fecha_inicio: new Date('2026-11-01T00:00:00.000Z'),
              fecha_cese: null,
            }),
        },
        asistencia_marcacion: {
          findFirst: jest.fn().mockResolvedValueOnce({ id: 'm-1' }).mockResolvedValueOnce(null),
        },
      } as any;
      const fecha = new Date('2026-10-05T13:00:00.000Z');

      // Act & Assert
      await expect(obtenerColaborador(prismaMock, '72345678', fecha)).resolves.toEqual(
        expect.objectContaining({ id: 'emp-1' }),
      );
      await expect(obtenerColaborador(prismaMock, '00000000', fecha)).rejects.toThrow(NotFoundException);
      await expect(obtenerColaborador(prismaMock, '72345678', fecha)).rejects.toThrow(BadRequestException);

      await expect(validarExistencia(prismaMock, 'emp-1', fecha, 'ENTRADA')).resolves.toBe(true);
      await expect(validarExistencia(prismaMock, 'emp-1', fecha, 'SALIDA')).resolves.toBe(false);
    });
  });
});
