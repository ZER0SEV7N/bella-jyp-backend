/** Actualización de esta prueba: Arrange prepara datos y mocks; Act ejecuta la operación; Assert comprueba el resultado y sus efectos. Se conservan los comentarios originales. */
// Actualización AAA: los datos de Arrange y las verificaciones corresponden al contrato actual.
// Actualización AAA: Arrange prepara mocks del contrato actual; Act ejecuta el caso; Assert verifica su resultado.
//test/modules/RRHH/organizacion/empleados/estadoEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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

  const mockPrisma = {
    empleados: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    vinculo_laboral: {
      create: jest.fn(),
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
          estado_laboral: 'ACTIVO',
          deleted_at: null,
        });
        mockPrisma.empleados.update.mockResolvedValue({
          id: idEmpleado,
          activo: false,
          estado_laboral: 'CESADO',
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
            estado_laboral: 'CESADO',
            fecha_cese: expect.any(Date) as unknown,
            deleted_at: expect.any(Date) as unknown,
          },
          include: expect.any(Object) as unknown,
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
        expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
      });

      it('Debe capturar errores de BD y lanzar InternalServerErrorException', async () => {
        // Arrange: Simulamos que el empleado existe pero la base de datos falla al actualizar
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          deleted_at: null,
        });
        mockPrisma.empleados.update.mockRejectedValue(
          new Error('Conexión perdida a PostgreSQL')
        );

        // Act & Assert: Ejecutamos el caso de uso y verificamos que se envuelva en InternalServerErrorException
        await expect(useCase.desactivar(idEmpleado)).rejects.toThrow(
          InternalServerErrorException
        );
      });
    });
  });

  // =========================================================================
  // 2. reactivar()
  // =========================================================================
  describe('reactivar()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe reactivar al colaborador registrando un nuevo vínculo laboral', async () => {
        // Arrange: Simulamos que el empleado se encuentra cesado (activo=false)
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          area_id: 'area-1',
          cargo_id: 'cargo-1',
          nro_documento: '70112233',
          activo: false,
          deleted_at: new Date('2026-01-01'),
        });

        const vinculoCreado = {
          id: 'vinculo-uuid-1',
          empleado_id: idEmpleado,
          fecha_inicio: new Date(),
        };
        mockPrisma.vinculo_laboral.create.mockResolvedValue(vinculoCreado);

        // Act: Ejecutamos el caso de uso para reactivar al empleado
        const result = await useCase.reactivar(idEmpleado);

        // Assert: Verificamos la creación del vínculo laboral y el mensaje informativo
        expect(result.state).toBe(true);
        expect(result.data).toEqual(vinculoCreado);
        expect(mockPrisma.vinculo_laboral.create).toHaveBeenCalledWith({
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
        expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
      });

      it('Debe lanzar BadRequestException si el colaborador ya se encuentra activo', async () => {
        // Arrange: Simulamos que el empleado ya está activo en el sistema
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          nro_documento: '70112233',
          activo: true,
          estado_laboral: 'ACTIVO',
          deleted_at: null,
        });

        // Act & Assert: Ejecutamos el caso de uso y verificamos que se bloquee por redundancia
        await expect(useCase.reactivar(idEmpleado)).rejects.toThrow(
          BadRequestException
        );
        expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
      });

      it('Debe capturar fallos inesperados de BD y lanzar InternalServerErrorException', async () => {
        // Arrange: Simulamos que el empleado está cesado pero la creación del vínculo falla
        mockPrisma.empleados.findUnique.mockResolvedValue({
          id: idEmpleado,
          activo: false,
          nro_documento: '70112233',
          deleted_at: new Date(),
        });
        mockPrisma.vinculo_laboral.create.mockRejectedValue(
          new Error('Fallo crítico en transacción')
        );

        // Act & Assert: Ejecutamos el caso de uso y verificamos la excepción interna
        await expect(useCase.reactivar(idEmpleado)).rejects.toThrow(
          InternalServerErrorException
        );
      });
    });
  });
});
