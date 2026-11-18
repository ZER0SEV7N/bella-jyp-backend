//test/modules/core/audit/use-cases/actividadAuditoria.useCase.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListarActividadUseCase } from '@/modules/core/audit/use-cases/listarActividad.useCase';
import { ListarLineaTiempoAfectadoUseCase } from '@/modules/core/audit/use-cases/listarLineaTiempoAfectado.useCase';
import { ObtenerActividadPorIdUseCase } from '@/modules/core/audit/use-cases/obtenerActividadPorId.useCase';
import { TABLAS_PERMITIDAS_RRHH } from '@/modules/core/audit/config/auditoria-tablas.config';
import type { PrismaService } from '@/common/prisma/prisma.service';

const ID_EMPLEADO = '0192a000-0000-7000-8000-000000000001';

function crearPrismaSimulado(filas: unknown[] = []) {
  const catalogo = () => ({ findMany: jest.fn().mockResolvedValue([]) });
  const mock = {
    audit_log: {
      count: jest.fn().mockResolvedValue(filas.length),
      findMany: jest.fn().mockResolvedValue(filas),
      findFirst: jest.fn().mockResolvedValue(filas[0] ?? null),
    },
    empleados: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: ID_EMPLEADO,
          nombre: 'Luis',
          apellido: 'Quispe',
          nro_documento: '45871236',
        },
      ]),
    },
    area: catalogo(),
    cargo: catalogo(),
    jornada: catalogo(),
    bancos: catalogo(),
    tipo_afp: catalogo(),
    regimen_pension: catalogo(),
    tipo_documento: catalogo(),
    usuarios: catalogo(),
    $transaction: jest.fn((consultas: Promise<unknown>[]) =>
      Promise.all(consultas)
    ),
  };
  return { mock, prisma: mock as unknown as PrismaService };
}

const filaContrato = {
  id: '0193a000-0000-7000-8000-000000000001',
  created_at: new Date('2026-11-08T15:20:00.000Z'),
  accion: 'CREATE',
  tabla_afectada: 'contratos',
  registro_id: '0192a000-0000-7000-8000-000000000010',
  valores_antes: null,
  valores_despues: { empleado_id: ID_EMPLEADO, estado: 'VIGENTE' },
  afectado_tipo: 'empleado',
  afectado_id: ID_EMPLEADO,
  usuarios: null,
};

describe('ListarActividadUseCase', () => {
  it('Debe paginar, pasar los filtros de afectado y fechas y presentar las filas', async () => {
    // Arrange
    const { mock, prisma } = crearPrismaSimulado([filaContrato]);
    const useCase = new ListarActividadUseCase(prisma);

    // Act
    const resultado = await useCase.execute(
      {
        page: 2,
        limit: 10,
        afectado_tipo: 'empleado',
        afectado_id: ID_EMPLEADO,
        desde: '2026-11-01',
        hasta: '2026-11-30',
      },
      { id: 'u1', rol: 'ADMIN' }
    );

    // Assert
    const where = (
      (mock.audit_log.findMany.mock.calls as unknown[][])[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    expect(where).toMatchObject({
      afectado_tipo: 'empleado',
      afectado_id: ID_EMPLEADO,
    });
    expect(where.created_at).toEqual({
      gte: new Date('2026-11-01T05:00:00.000Z'),
      lt: new Date('2026-12-01T05:00:00.000Z'),
    });
    expect(mock.audit_log.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
    expect(resultado.meta).toEqual({
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
    expect(resultado.data[0]).toMatchObject({
      accion_etiqueta: 'Creación',
      resumen: 'Registró un contrato de Luis Quispe',
    });
  });

  it('Debe restringir a RRHH a las tablas de su ámbito cuando no pide una tabla', async () => {
    // Arrange
    const { mock, prisma } = crearPrismaSimulado();
    const useCase = new ListarActividadUseCase(prisma);

    // Act
    await useCase.execute({ page: 1, limit: 50 }, { id: 'u1', rol: 'RRHH' });

    // Assert
    const where = (
      (mock.audit_log.count.mock.calls as unknown[][])[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    expect(where.tabla_afectada).toEqual({ in: [...TABLAS_PERMITIDAS_RRHH] });
  });

  it('Debe rechazar a RRHH que pide una tabla fuera de su ámbito', async () => {
    // Arrange
    const { prisma } = crearPrismaSimulado();
    const useCase = new ListarActividadUseCase(prisma);

    // Act y Assert
    await expect(
      useCase.execute(
        { page: 1, limit: 50, tabla_afectada: 'usuarios' },
        { id: 'u1', rol: 'RRHH' }
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('Debe rechazar a los roles que no pueden auditar', async () => {
    // Arrange
    const { prisma } = crearPrismaSimulado();
    const useCase = new ListarActividadUseCase(prisma);

    // Act y Assert
    await expect(
      useCase.execute({ page: 1, limit: 50 }, { id: 'u1', rol: 'EMPLEADO' })
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('ObtenerActividadPorIdUseCase', () => {
  it('Debe devolver el detalle con cambios y aplicar el filtro de rol en la consulta', async () => {
    // Arrange
    const { mock, prisma } = crearPrismaSimulado([filaContrato]);
    const useCase = new ObtenerActividadPorIdUseCase(prisma);

    // Act
    const detalle = await useCase.execute(filaContrato.id, {
      id: 'u1',
      rol: 'RRHH',
    });

    // Assert
    const where = (
      (mock.audit_log.findFirst.mock.calls as unknown[][])[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    expect(where).toMatchObject({
      id: filaContrato.id,
      tabla_afectada: { in: [...TABLAS_PERMITIDAS_RRHH] },
    });
    expect(detalle.cambios).toEqual([
      {
        campo: 'estado',
        etiqueta: 'Estado del contrato',
        tipo: 'enum',
        antes: null,
        despues: 'Vigente',
      },
    ]);
  });

  it('Debe lanzar 404 si el registro no existe o el rol no lo puede ver', async () => {
    // Arrange
    const { prisma } = crearPrismaSimulado([]);
    const useCase = new ObtenerActividadPorIdUseCase(prisma);

    // Act y Assert
    await expect(
      useCase.execute(filaContrato.id, { id: 'u1', rol: 'RRHH' })
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ListarLineaTiempoAfectadoUseCase', () => {
  it('Debe filtrar por el tipo e ID del afectado y ordenar de lo más reciente a lo más antiguo', async () => {
    // Arrange
    const { mock, prisma } = crearPrismaSimulado([filaContrato]);
    const useCase = new ListarLineaTiempoAfectadoUseCase(prisma);

    // Act
    const resultado = await useCase.execute(
      { tipo: 'empleado', id: ID_EMPLEADO },
      { page: 1, limit: 20 },
      { id: 'u1', rol: 'ADMIN' }
    );

    // Assert
    expect(mock.audit_log.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { afectado_tipo: 'empleado', afectado_id: ID_EMPLEADO },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      })
    );
    expect(resultado.data).toHaveLength(1);
  });
});
