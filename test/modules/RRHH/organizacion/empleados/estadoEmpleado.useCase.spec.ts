//test/modules/RRHH/organizacion/empleados/estadoEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/estadoEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso EstadoEmpleadoUseCase.
 * Se verifica el cese atómico (EMP-F3) y la reactivación con validación de área, cargo y jornada (EMP-F7).
 * Se utilizan mocks para simular la interacción con PrismaService y evitar llamadas reales a la base de datos.
 */
describe('EstadoEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: EstadoEmpleadoUseCase;

  //Transacción simulada: replica los delegados que usan el caso de uso y sus helpers de cese.
  const mockTx = {
    empleados: { update: jest.fn() },
    vinculo_laboral: { updateMany: jest.fn(), create: jest.fn() },
    usuarios: { updateMany: jest.fn() },
    tokens_seguridad: { updateMany: jest.fn() },
    contratos: { updateMany: jest.fn() },
    solicitud: { updateMany: jest.fn() },
  };

  const mockPrisma = {
    empleados: { findUnique: jest.fn() },
    area: { findUnique: jest.fn() },
    cargo: { findUnique: jest.fn() },
    jornada: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const idEmpleado = '018f4a7c-emp-0000-0000-000000000001';

  beforeEach(async () => {
    //La transacción ejecuta el callback con los mocks de sus delegados.
    mockPrisma.$transaction.mockImplementation(
      (callback: (tx: typeof mockTx) => unknown) => callback(mockTx)
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EstadoEmpleadoUseCase>(EstadoEmpleadoUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // 1. desactivar()
  // =========================================================================
  describe('desactivar()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe aplicar Soft Delete correctamente y registrar la fecha de cese', async () => {
        // Arrange: el empleado existe y la transacción actualiza el legajo.
        const empleadoCesado = {
          id: idEmpleado,
          activo: false,
          estado_laboral: 'CESADO',
          fecha_cese: new Date(),
          deleted_at: new Date(),
        };
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          activo: true,
          estado_laboral: 'ACTIVO',
          fecha_inicio: new Date('2025-01-01'),
          deleted_at: null,
        });
        mockTx.empleados.update.mockResolvedValue(empleadoCesado);
        mockTx.vinculo_laboral.updateMany.mockResolvedValue({ count: 1 });
        mockTx.usuarios.updateMany.mockResolvedValue({ count: 1 });
        mockTx.tokens_seguridad.updateMany.mockResolvedValue({ count: 1 });
        mockTx.contratos.updateMany.mockResolvedValue({ count: 1 });
        mockTx.solicitud.updateMany.mockResolvedValue({ count: 0 });

        // Act: Ejecutamos el caso de uso para cesar al empleado.
        const result = await useCase.desactivar(idEmpleado, {
          motivo_cese: 'Renuncia voluntaria',
        });

        // Assert: el legajo queda inactivo y el motivo se conserva para auditoría.
        expect(result.activo).toBe(false);
        expect(mockTx.empleados.update).toHaveBeenCalledWith({
          where: { id: idEmpleado },
          data: {
            activo: false,
            estado_laboral: 'CESADO',
            fecha_cese: expect.any(Date) as unknown,
            motivo_cese: 'Renuncia voluntaria',
            deleted_at: expect.any(Date) as unknown,
          },
          include: expect.any(Object) as unknown,
        });
        // El cese cierra el vínculo laboral vigente.
        expect(mockTx.vinculo_laboral.updateMany).toHaveBeenCalledWith({
          where: { empleado_id: idEmpleado, fecha_cese: null },
          data: { fecha_cese: expect.any(Date) as unknown },
        });
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el colaborador no existe o ya está eliminado', async () => {
        // Arrange: Simulamos que el empleado no existe o ya posee deleted_at
        mockPrisma.empleados.findUnique.mockResolvedValue(null);

        // Act & Assert: Ejecutamos el caso de uso y verificamos que se lance NotFoundException
        await expect(useCase.desactivar('emp-404')).rejects.toThrow(
          NotFoundException
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('Debe rechazar una fecha de cese anterior al ingreso', async () => {
        // Arrange: la fecha de cese precede a la fecha de inicio del vínculo.
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          fecha_inicio: new Date('2026-05-01'),
          deleted_at: null,
        });

        // Act & Assert
        await expect(
          useCase.desactivar(idEmpleado, { fecha_cese: '2026-01-01' })
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('Debe propagar el fallo de la transacción cuando la base de datos no responde', async () => {
        // Arrange: el empleado existe, pero la transacción falla.
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          fecha_inicio: new Date('2025-01-01'),
          deleted_at: null,
        });
        mockPrisma.$transaction.mockRejectedValueOnce(
          new Error('Conexión perdida a PostgreSQL')
        );

        // Act & Assert: el cese es atómico, por lo que no se reporta éxito parcial.
        await expect(useCase.desactivar(idEmpleado)).rejects.toThrow(
          'Conexión perdida a PostgreSQL'
        );
      });
    });
  });

  // =========================================================================
  // 2. reactivar()
  // =========================================================================
  describe('reactivar()', () => {
    //Empleado cesado con área, cargo y jornada asignados.
    const empleadoCesado = {
      id: idEmpleado,
      area_id: 'area-1',
      cargo_id: 'cargo-1',
      jornada_id: 'jornada-1',
      nro_documento: '70112233',
      activo: false,
      deleted_at: new Date('2026-01-01'),
    };

    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe reactivar al colaborador registrando un nuevo vínculo laboral', async () => {
        // Arrange: el empleado está cesado y sus maestros siguen activos.
        const empleadoReactivado = {
          id: idEmpleado,
          activo: true,
          estado_laboral: 'ACTIVO',
          fecha_cese: null,
        };
        mockPrisma.empleados.findUnique.mockResolvedValue(empleadoCesado);
        mockPrisma.area.findUnique.mockResolvedValue({
          id: 'area-1',
          activo: true,
        });
        mockPrisma.cargo.findUnique.mockResolvedValue({
          id: 'cargo-1',
          activo: true,
        });
        mockPrisma.jornada.findUnique.mockResolvedValue({
          id: 'jornada-1',
          activo: true,
        });
        mockTx.empleados.update.mockResolvedValue(empleadoReactivado);
        mockTx.vinculo_laboral.create.mockResolvedValue({
          id: 'vinculo-uuid-1',
          empleado_id: idEmpleado,
        });

        // Act: Ejecutamos el caso de uso para reactivar al empleado
        const result = await useCase.reactivar(idEmpleado);

        // Assert: se crea un nuevo vínculo y se devuelve el legajo reactivado.
        expect(result.state).toBe(true);
        expect(result.data).toEqual(empleadoReactivado);
        expect(mockTx.vinculo_laboral.create).toHaveBeenCalledWith({
          data: {
            id: expect.any(String) as unknown,
            empleado_id: idEmpleado,
            fecha_inicio: expect.any(Date) as unknown,
          },
        });
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el colaborador no existe en los registros', async () => {
        // Arrange: Simulamos que el ID no coincide con ningún registro
        mockPrisma.empleados.findUnique.mockResolvedValue(null);

        // Act & Assert: Ejecutamos el caso de uso y verificamos NotFoundException
        await expect(useCase.reactivar('emp-inexistente')).rejects.toThrow(
          NotFoundException
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('Debe lanzar BadRequestException si el colaborador ya se encuentra activo', async () => {
        // Arrange: Simulamos que el empleado ya está activo en el sistema
        mockPrisma.empleados.findUnique.mockResolvedValue({
          ...empleadoCesado,
          activo: true,
          deleted_at: null,
        });

        // Act & Assert: Ejecutamos el caso de uso y verificamos que se bloquee por redundancia
        await expect(useCase.reactivar(idEmpleado)).rejects.toThrow(
          BadRequestException
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('Debe impedir el reingreso si el área asignada está inactiva (EMP-F7)', async () => {
        // Arrange: el área fue desactivada mientras el colaborador estaba cesado.
        mockPrisma.empleados.findUnique.mockResolvedValue(empleadoCesado);
        mockPrisma.area.findUnique.mockResolvedValue({
          id: 'area-1',
          activo: false,
        });
        mockPrisma.cargo.findUnique.mockResolvedValue({
          id: 'cargo-1',
          activo: true,
        });
        mockPrisma.jornada.findUnique.mockResolvedValue({
          id: 'jornada-1',
          activo: true,
        });

        // Act & Assert
        await expect(useCase.reactivar(idEmpleado)).rejects.toThrow(
          NotFoundException
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('Debe propagar el fallo de la transacción al crear el vínculo laboral', async () => {
        // Arrange: los maestros están activos, pero la transacción falla.
        mockPrisma.empleados.findUnique.mockResolvedValue(empleadoCesado);
        mockPrisma.area.findUnique.mockResolvedValue({
          id: 'area-1',
          activo: true,
        });
        mockPrisma.cargo.findUnique.mockResolvedValue({
          id: 'cargo-1',
          activo: true,
        });
        mockPrisma.jornada.findUnique.mockResolvedValue({
          id: 'jornada-1',
          activo: true,
        });
        mockPrisma.$transaction.mockRejectedValueOnce(
          new Error('Fallo crítico en transacción')
        );

        // Act & Assert
        await expect(useCase.reactivar(idEmpleado)).rejects.toThrow(
          'Fallo crítico en transacción'
        );
      });
    });
  });
});
