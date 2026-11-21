import { ConflictException } from '@nestjs/common';
import { GuardarDescansoAsistenciaUseCase } from '@/modules/asistencia/use-cases/asistencias/guardarDescansoAsistencia.useCase';

const bloquearPeriodoMock = jest.fn();

jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn(
    (_p: unknown, _a: unknown, fn: (tx: unknown) => unknown) => fn(_p)
  ),
  bloquearEmpleado: jest.fn(),
  bloquearPeriodo: (...args: unknown[]) => {
    bloquearPeriodoMock(...args);
    return Promise.resolve();
  },
}));

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('GuardarDescansoAsistenciaUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const dto = {
    fecha: '2026-09-10',
    nombre: 'Descanso local',
    motivo: 'Prueba ficticia',
    activo: true,
  };
  const prisma = {
    incidencias_mes: { count: jest.fn(), updateMany: jest.fn() },
    historial_planillas: { findFirst: jest.fn() },
    asistencia_calendario: { upsert: jest.fn() },
  };
  const caso = new GuardarDescansoAsistenciaUseCase(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.incidencias_mes.count.mockResolvedValue(0);
    prisma.incidencias_mes.updateMany.mockResolvedValue({ count: 0 });
    prisma.historial_planillas.findFirst.mockResolvedValue(null);
  });

  it('permite guardar cuando el período está abierto y guarda la fecha civil y el responsable', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.asistencia_calendario.upsert.mockResolvedValue({ id: 'dia' });

    // Act: ejecutar una única operación del componente.
    const resultado = await caso.execute(dto, actor);

    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(resultado).toEqual({ id: 'dia' });
    expect(bloquearPeriodoMock).toHaveBeenCalledWith(prisma, '2026-09');
    expect(prisma.asistencia_calendario.upsert).toHaveBeenCalledTimes(1);
    const llamadas = prisma.asistencia_calendario.upsert.mock.calls as Array<
      [
        {
          where: { fecha: Date };
          create: { usuario_id: string; activo: boolean };
        },
      ]
    >;
    const llamada = llamadas[0][0];
    expect(llamada.where).toEqual({
      fecha: new Date('2026-09-10T00:00:00Z'),
    });
    expect(llamada.create.usuario_id).toBe(actor.id);
    expect(llamada.create.activo).toBe(true);
    expect(prisma.incidencias_mes.updateMany).toHaveBeenCalledWith({
      where: { periodo: '2026-09', estado: 'PENDIENTE', vigente: true },
      data: { vigente: false, version: { increment: 1 } },
    });
  });

  it('rechaza el cambio cuando el mes tiene resúmenes aprobados', async () => {
    // Arrange: existen incidencias aprobadas en el período.
    prisma.incidencias_mes.count.mockResolvedValue(2);

    // Act: intentar registrar un descanso en el mes aprobado.
    const operacion = caso.execute(dto, actor);

    // Assert: lanza ConflictException sin modificar el calendario.
    await expect(operacion).rejects.toThrow(ConflictException);
    expect(bloquearPeriodoMock).toHaveBeenCalledWith(prisma, '2026-09');
    expect(prisma.asistencia_calendario.upsert).not.toHaveBeenCalled();
    expect(prisma.incidencias_mes.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza el cambio cuando el mes tiene una planilla en estado CONGELADO', async () => {
    // Arrange: existe una planilla cerrada en el período.
    prisma.historial_planillas.findFirst.mockResolvedValue({
      id: 'planilla-1',
    });

    // Act: intentar registrar un descanso en el mes congelado.
    const operacion = caso.execute(dto, actor);

    // Assert: lanza ConflictException sin modificar el calendario.
    await expect(operacion).rejects.toThrow(ConflictException);
    expect(prisma.asistencia_calendario.upsert).not.toHaveBeenCalled();
    expect(prisma.incidencias_mes.updateMany).not.toHaveBeenCalled();
  });
});
