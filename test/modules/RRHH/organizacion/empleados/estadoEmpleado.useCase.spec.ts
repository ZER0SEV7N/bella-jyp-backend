//test/modules/RRHH/organizacion/empleados/estadoEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { EstadoEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/estadoEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso EstadoEmpleadoUseCase.
 * Se verifica que el caso de uso maneje correctamente el cambio de estado de empleados,
 * incluyendo validaciones de existencia y manejo de errores.
 * Se utilizan mocks para simular la interacción con PrismaService y evitar llamadas reales a la base de datos.
 */
describe('EstadoEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: EstadoEmpleadoUseCase;
  let prisma: PrismaService;

  const mockPrisma = {
    empleados: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const idEmpleado = '018f4a7c-emp-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EstadoEmpleadoUseCase>(EstadoEmpleadoUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // 1. desactivar()
  // =========================================================================
  describe('desactivar()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe aplicar Soft Delete correctamente y registrar la fecha de cese', async () => {
        // Arrange: Simulamos que el empleado existe y que la actualización es exitosa
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          activo: true,
          deleted_at: null,
        });
        mockPrisma.empleados.update.mockResolvedValue({
          id: idEmpleado,
          activo: false,
          fecha_cese: new Date(),
          deleted_at: new Date(),
        });

        // Act: Ejecutamos el caso de uso para eliminar el empleado
        const result = await useCase.desactivar(idEmpleado);

        // Assert: Verificamos que el empleado fue marcado como inactivo y que se registró la fecha de cese
        expect(result.activo).toBe(false);
        expect(mockPrisma.empleados.update).toHaveBeenCalledWith({
          where: { id: idEmpleado },
          data: {
            activo: false,
            fecha_cese: expect.any(Date),
            deleted_at: expect.any(Date),
          },
          include: expect.any(Object),
        });
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el colaborador no existe o ya está eliminado', async () => {
        // Arrange: Simulamos que el empleado no existe o ya posee deleted_at
        mockPrisma.empleados.findUnique.mockResolvedValue(null);

        // Act & Assert: Ejecutamos el caso de uso y verificamos que se lance NotFoundException
        await expect(useCase.desactivar('emp-404')).rejects.toThrow(NotFoundException);
        expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
      });

      it('Debe capturar errores de BD y lanzar InternalServerErrorException', async () => {
        // Arrange: Simulamos que el empleado existe pero la base de datos falla al actualizar
        mockPrisma.empleados.findUnique.mockResolvedValue({ id: idEmpleado, deleted_at: null });
        mockPrisma.empleados.update.mockRejectedValue(new Error('Conexión perdida a PostgreSQL'));

        // Act & Assert: Ejecutamos el caso de uso y verificamos que se envuelva en InternalServerErrorException
        await expect(useCase.desactivar(idEmpleado)).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  // =========================================================================
  // 2. reactivar()
  // =========================================================================
  describe('reactivar()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe reactivar al colaborador limpiando fecha_cese y deleted_at', async () => {
        // Arrange: Simulamos que el empleado se encuentra cesado (activo=false)
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          activo: false,
          deleted_at: new Date('2026-01-01'),
          fecha_cese: new Date('2026-01-01'),
        });

        mockPrisma.empleados.update.mockResolvedValue({
          id: idEmpleado,
          activo: true,
          deleted_at: null,
          fecha_cese: null,
        });

        // Act: Ejecutamos el caso de uso para reactivar al empleado
        const result = await useCase.reactivar(idEmpleado);

        // Assert: Verificamos la reactivación exitosa con mensaje informativo
        expect(result.state).toBe(true);
        expect(result.data.activo).toBe(true);
        expect(mockPrisma.empleados.update).toHaveBeenCalledWith({
          where: { id: idEmpleado },
          data: {
            activo: true,
            fecha_cese: null,
            deleted_at: null,
          },
          include: expect.any(Object),
        });
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el colaborador no existe en los registros', async () => {
        // Arrange: Simulamos que el ID no coincide con ningún registro
        mockPrisma.empleados.findUnique.mockResolvedValue(null);

        // Act & Assert: Ejecutamos el caso de uso y verificamos NotFoundException
        await expect(useCase.reactivar('emp-inexistente')).rejects.toThrow(NotFoundException);
        expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
      });

      it('Debe lanzar BadRequestException si el colaborador ya se encuentra activo', async () => {
        // Arrange: Simulamos que el empleado ya está activo en el sistema
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          nro_documento: '70112233',
          activo: true,
          deleted_at: null,
        });

        // Act & Assert: Ejecutamos el caso de uso y verificamos que se bloquee por redundancia
        await expect(useCase.reactivar(idEmpleado)).rejects.toThrow(BadRequestException);
        expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
      });

      it('Debe capturar fallos inesperados de BD y lanzar InternalServerErrorException', async () => {
        // Arrange: Simulamos que el empleado está cesado pero update falla
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          activo: false,
          deleted_at: new Date(),
        });
        mockPrisma.empleados.update.mockRejectedValue(new Error('Fallo crítico en transacción'));

        // Act & Assert: Ejecutamos el caso de uso y verificamos la excepción interna
        await expect(useCase.reactivar(idEmpleado)).rejects.toThrow(InternalServerErrorException);
      });
    });
  });
});