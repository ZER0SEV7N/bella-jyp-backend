import { AsignarJornadaAsistenciaUseCase } from '@/modules/asistencia/use-cases/asistencias/asignarJornadaAsistencia.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
import { HorarioAsistenciaSchema } from '@jyp/shared-contracts';
import { horario } from '../../../../fixtures/motores.fixture';
import { Prisma } from '@prisma/client';
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('AsignarJornadaAsistenciaUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    empleados: { findUnique: jest.fn() },
    jornada: { findUnique: jest.fn() },
    asistencia_jornada: { findUnique: jest.fn(), create: jest.fn() },
  };
  const caso = new AsignarJornadaAsistenciaUseCase(prisma as never);
  const dto = {
    empleado_id: 'e',
    jornada_id: 'j',
    desde: '2026-09-01',
    politica_tolerancia: 'COMPLETA',
    motivo: 'Asignación de prueba',
  };
  beforeEach(() => jest.clearAllMocks());
  it('registra una sola vigencia inicial con copia del horario', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.empleados.findUnique.mockResolvedValue({
      fecha_inicio: new Date('2026-09-01'),
    });
    prisma.jornada.findUnique.mockResolvedValue({
      horario_semanal: horario,
      turno: 'MANANA',
      total_horas_semana: new Prisma.Decimal(40),
      tolerancia_minutos: 5,
    });
    prisma.asistencia_jornada.findUnique.mockResolvedValue(null);
    prisma.asistencia_jornada.create.mockResolvedValue({
      id: 'asignacion',
    });
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute(dto as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.id).toBe('asignacion');
    expect(prisma.asistencia_jornada.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        desde: new Date('2026-09-01'),
        minutos_semana: 2400,
        usuario_id: actor.id,
        horario: HorarioAsistenciaSchema.parse(horario),
      }),
    });
  });
  it('impide dos asignaciones desde la misma fecha', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.empleados.findUnique.mockResolvedValue({
      fecha_inicio: new Date('2026-09-01'),
    });
    prisma.jornada.findUnique.mockResolvedValue({
      horario_semanal: horario,
      turno: 'MANANA',
      total_horas_semana: new Prisma.Decimal(40),
      tolerancia_minutos: 5,
    });
    prisma.asistencia_jornada.findUnique.mockResolvedValue({
      id: 'existente',
    });
    // Act: ejecutar una única operación del componente.
    const r = caso.execute(dto as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('Ya existe');
    expect(prisma.asistencia_jornada.create).not.toHaveBeenCalled();
  });
});

describe('Asignación de jornada: validaciones antes de persistir', () => {
  const prisma = {
    empleados: { findUnique: jest.fn() },
    jornada: { findUnique: jest.fn() },
    asistencia_jornada: { findUnique: jest.fn(), create: jest.fn() },
  };
  const caso = new AsignarJornadaAsistenciaUseCase(prisma as never);
  const dto = {
    empleado_id: 'empleado',
    jornada_id: 'jornada',
    desde: '2026-09-01',
    politica_tolerancia: 'COMPLETA',
    motivo: 'Cambio documentado',
  } as const;
  beforeEach(() => {
    jest.resetAllMocks();
    // La transacción está simulada para ejecutar únicamente las reglas del caso de uso.
    jest
      .requireMock('@/common/utils/transaccion-auditada.util')
      .transaccionAuditada.mockImplementation(
        (p: unknown, _a: unknown, fn: Function) => fn(p)
      );
    prisma.empleados.findUnique.mockResolvedValue({
      fecha_inicio: new Date('2026-08-01'),
    });
    prisma.jornada.findUnique.mockResolvedValue({
      horario_semanal: horario,
      turno: 'MANANA',
      total_horas_semana: new Prisma.Decimal(40),
      tolerancia_minutos: 5,
    });
    prisma.asistencia_jornada.findUnique.mockResolvedValue(null);
  });
  it.each([null, { fecha_inicio: null }])(
    'requiere empleado y fecha de ingreso',
    async (empleado) => {
      // Arrange: empleado inexistente o sin fecha necesaria para la vigencia.
      prisma.empleados.findUnique.mockResolvedValue(empleado);
      // Act: asignar el horario al legajo solicitado.
      const resultado = caso.execute(dto, { id: 'rrhh', ip: '127.0.0.1' });
      // Assert: no consultar horarios ni escribir una asignación sin vínculo laboral.
      await expect(resultado).rejects.toMatchObject({ status: 400 });
      expect(prisma.jornada.findUnique).not.toHaveBeenCalled();
    }
  );
  it.each([
    ['ausente', null, 404],
    ['horario inválido', { horario_semanal: [] }, 400],
    ['rotativa', { horario_semanal: horario, turno: 'ROTATIVO' }, 400],
    ['nocturna', { horario_semanal: horario, turno: 'NOCHE' }, 400],
    [
      'total incoherente',
      {
        horario_semanal: horario,
        turno: 'MANANA',
        total_horas_semana: new Prisma.Decimal(48),
      },
      400,
    ],
  ])('rechaza una jornada %s', async (_nombre, jornada, status) => {
    // Arrange: configurar una condición inválida de la jornada.
    prisma.jornada.findUnique.mockResolvedValue(jornada);
    // Act: intentar crear una nueva vigencia.
    const resultado = caso.execute(dto, { id: 'rrhh', ip: '127.0.0.1' });
    // Assert: el horario defectuoso nunca se copia al historial.
    await expect(resultado).rejects.toMatchObject({ status });
    expect(prisma.asistencia_jornada.create).not.toHaveBeenCalled();
  });
  it('rechaza una asignación anterior al ingreso del trabajador', async () => {
    // Arrange: el empleado recién ingresa después de la fecha solicitada.
    prisma.empleados.findUnique.mockResolvedValue({
      fecha_inicio: new Date('2026-09-02'),
    });
    // Act: intentar retroceder la jornada fuera del vínculo.
    const resultado = caso.execute(dto, { id: 'rrhh', ip: '127.0.0.1' });
    // Assert: no crear vigencias previas a la relación laboral.
    await expect(resultado).rejects.toThrow('antes del ingreso');
    expect(prisma.asistencia_jornada.create).not.toHaveBeenCalled();
  });
});
