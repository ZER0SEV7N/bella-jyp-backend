//test/modules/RRHH/empleados/eliminarEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EliminarEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/eliminarEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso EliminarEmpleadoUseCase.
 * Se verifica que el caso de uso maneje correctamente la eliminación de empleados,
 * incluyendo validaciones de existencia y manejo de errores.
 * Se utilizan mocks para simular la interacción con PrismaService y evitar llamadas reales a la base de datos.
 */
describe('EliminarEmpleadoUseCase', () => {
  let useCase: EliminarEmpleadoUseCase;
  let mockPrisma: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = { empleados: { findUnique: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EliminarEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<EliminarEmpleadoUseCase>(EliminarEmpleadoUseCase);
  });

  afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba para evitar interferencias entre pruebas

  it('Debería aplicar Soft Delete correctamente y registrar la fecha de cese', async () => {
    //Arrange: Simulamos que el empleado existe y que la actualización es exitosa
    mockPrisma.empleados.findUnique.mockResolvedValue({
      id: 'emp-123',
      deleted_at: null
    });
    mockPrisma.empleados.update.mockResolvedValue({
      id: 'emp-123',
      activo: false
    });

    //Act: Ejecutamos el caso de uso para eliminar el empleado
    const result = await useCase.execute('emp-123');

    //Assert: Verificamos que el empleado fue marcado como inactivo y que se registró la fecha de cese
    expect(result.activo).toBe(false);
    expect(mockPrisma.empleados.update).toHaveBeenCalledWith({
      where: { id: 'emp-123' },
      data: {
        activo: false,
        fecha_cese: expect.any(Date),
        deleted_at: expect.any(Date)
      }
    });
  });

  it('Debería lanzar NotFoundException si no existe o ya está eliminado', async () => {
    //Arrange: Simulamos que el empleado no existe o ya está eliminado
    mockPrisma.empleados.findUnique.mockResolvedValue(null);
    //Act & Assert: Ejecutamos el caso de uso y verificamos que se lance la excepción esperada
    await expect(useCase.execute('emp-404')).rejects.toThrow(NotFoundException);
  });

  it('Debería lanzar BadRequestException genérica si la DB falla al actualizar', async () => {
    //Arrange: Simulamos que el empleado existe y que la base de datos falla al actualizar
    mockPrisma.empleados.findUnique.mockResolvedValue({
      id: 'emp-123',
      deleted_at: null
    });
    mockPrisma.empleados.update.mockRejectedValue(new Error('DB Error'));

    //Act & Assert: Ejecutamos el caso de uso y verificamos que se lance la excepción esperada
    await expect(useCase.execute('emp-123')).rejects.toThrow(BadRequestException);
  });
});
