//test/modules/RRHH/empleados/editarEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EditarEmpleadoUseCase } from '@/modules/RRHH/use-cases/empleado/editarEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso EditarEmpleadoUseCase.
 * Se verifica que el caso de uso maneje correctamente la edición de empleados,
 * incluyendo validaciones de existencia, duplicidad de documentos y actualizaciones exitosas.
 * Se utilizan mocks para simular la interacción con PrismaService y evitar llamadas reales a la base de datos.
 */
describe('EditarEmpleadoUseCase', () => {
  let useCase: EditarEmpleadoUseCase;
  let mockPrisma: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = { empleados: { findUnique: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditarEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EditarEmpleadoUseCase>(EditarEmpleadoUseCase);
  });

  afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba para evitar interferencias entre pruebas

  it('Debería actualizar el empleado correctamente sin cambio de documento', async () => {
    //Arrange: Simulamos que el empleado existe y que la actualización es exitosa
    const payload = { nombre: 'Juan Editado' };
    mockPrisma.empleados.findUnique.mockResolvedValue({
      id: 'emp-123',
      nro_documento: '7011',
      deleted_at: null,
    });
    mockPrisma.empleados.update.mockResolvedValue({
      id: 'emp-123',
      nombre: 'Juan Editado',
    });

    //Act: Ejecutamos el caso de uso con los datos de actualización
    const result = await useCase.execute('emp-123', payload as any);

    //Assert: Verificamos que el empleado fue actualizado correctamente
    expect(result.nombre).toBe('Juan Editado');
    expect(mockPrisma.empleados.update).toHaveBeenCalled();
  });

  it('Debería actualizar el documento si el nuevo no colisiona', async () => {
    //Arrange: Simulamos que el empleado existe y que el nuevo documento no colisiona
    const payload = { nro_documento: '9999' };
    //Encontrar al empleado a editar
    mockPrisma.empleados.findUnique.mockResolvedValueOnce({
      id: 'emp-123',
      nro_documento: '7011',
      deleted_at: null,
    });
    //Buscar si el 9999 choca con alguien más. Devuelve null (está libre)
    mockPrisma.empleados.findUnique.mockResolvedValueOnce(null);
    mockPrisma.empleados.update.mockResolvedValue({});

    //Act: Ejecutamos el caso de uso con el nuevo documento
    await useCase.execute('emp-123', payload as any);

    //Assert: Verificamos que la actualización se realizó correctamente
    expect(mockPrisma.empleados.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'emp-123' }),
        data: expect.objectContaining({ nro_documento: '9999' }),
      }),
    );
  });

  it('Debería lanzar BadRequestException si el nuevo documento ya pertenece a otro', async () => {
    //Arrange: Simulamos que el empleado existe y que el nuevo documento ya pertenece a otro empleado
    const payload = { nro_documento: '9999' };
    mockPrisma.empleados.findUnique.mockResolvedValueOnce({
      id: 'emp-123',
      nro_documento: '7011',
      deleted_at: null,
    });
    mockPrisma.empleados.findUnique.mockResolvedValueOnce({ id: 'emp-456' });

    //Act & Assert: Ejecutamos el caso de uso y verificamos que se lance la excepción esperada
    await expect(
      useCase.execute('emp-123', payload as any),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ title: 'Documento Duplicado' }),
    });
    expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
  });

  it('Debería lanzar NotFoundException si el empleado no existe o está eliminado', async () => {
    //Arrange: Simulamos que el empleado no existe o está eliminado
    mockPrisma.empleados.findUnique.mockResolvedValue({
      id: 'emp-123',
      deleted_at: new Date(),
    });

    //Act & Assert: Ejecutamos el caso de uso y verificamos que se lance la excepción esperada
    await expect(useCase.execute('emp-123', {} as any)).rejects.toThrow(
      NotFoundException,
    );
  });
});
