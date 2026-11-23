import { ListarCalendarioAsistenciaUseCase } from '@/modules/asistencia/use-cases/asistencias/listarCalendarioAsistencia.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ListarCalendarioAsistenciaUseCase', () => {
  const prisma = {
    asistencia_calendario: { findMany: jest.fn() },
    incidencias_mes: { findMany: jest.fn() },
    historial_planillas: { findMany: jest.fn() },
  };
  const caso = new ListarCalendarioAsistenciaUseCase(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mezcla nacionales y adicionales ordenados, incluye inactivos y marca periodo_cerrado', async () => {
    // Arrange: descansos adicionales (uno coincidente con feriado nacional y uno inactivo) y dos meses cerrados.
    prisma.asistencia_calendario.findMany.mockResolvedValue([
      {
        id: 'adic-1',
        fecha: new Date('2026-01-01T00:00:00.000Z'),
        nombre: 'Asueto adicional Año Nuevo',
        motivo: 'Acuerdo interno',
        activo: true,
        updated_at: new Date('2026-01-02T10:00:00.000Z'),
      },
      {
        id: 'adic-2',
        fecha: new Date('2026-06-15T00:00:00.000Z'),
        nombre: 'Día no laborable anulado',
        motivo: 'Reprogramación',
        activo: false,
        updated_at: new Date('2026-06-10T15:30:00.000Z'),
      },
    ]);
    prisma.incidencias_mes.findMany.mockResolvedValue([{ periodo: '2026-01' }]);
    prisma.historial_planillas.findMany.mockResolvedValue([
      { periodo: '2026-06' },
    ]);

    // Act: listar el calendario del año 2026.
    const resultado = await caso.execute(2026);

    // Assert: verifica consulta del año completo, meses cerrados, orden y estructura de días.
    expect(prisma.asistencia_calendario.findMany).toHaveBeenCalledWith({
      where: {
        fecha: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-12-31T00:00:00.000Z'),
        },
      },
      orderBy: { fecha: 'asc' },
    });
    expect(resultado.anio).toBe(2026);
    expect(resultado.meses_cerrados).toEqual(['2026-01', '2026-06']);

    // En la misma fecha (2026-01-01) aparece primero el nacional y luego el adicional.
    expect(resultado.dias[0]).toEqual({
      fecha: '2026-01-01',
      nombre: 'Año Nuevo',
      origen: 'NACIONAL',
      id: null,
      motivo: null,
      activo: true,
      periodo_cerrado: true,
      actualizado_en: null,
    });
    expect(resultado.dias[1]).toEqual({
      fecha: '2026-01-01',
      nombre: 'Asueto adicional Año Nuevo',
      origen: 'ADICIONAL',
      id: 'adic-1',
      motivo: 'Acuerdo interno',
      activo: true,
      periodo_cerrado: true,
      actualizado_en: '2026-01-02T10:00:00.000Z',
    });

    // Incluye el adicional inactivo en su posición cronológica con periodo_cerrado=true.
    const inactivo = resultado.dias.find((d) => d.id === 'adic-2');
    expect(inactivo).toEqual({
      fecha: '2026-06-15',
      nombre: 'Día no laborable anulado',
      origen: 'ADICIONAL',
      id: 'adic-2',
      motivo: 'Reprogramación',
      activo: false,
      periodo_cerrado: true,
      actualizado_en: '2026-06-10T15:30:00.000Z',
    });

    // Un mes abierto queda marcado con periodo_cerrado=false.
    const navidad = resultado.dias.find((d) => d.fecha === '2026-12-25');
    expect(navidad?.periodo_cerrado).toBe(false);

    // Verifica orden ascendente por fecha.
    const fechas = resultado.dias.map((d) => d.fecha);
    expect(fechas).toEqual([...fechas].sort((a, b) => a.localeCompare(b)));
  });
});
