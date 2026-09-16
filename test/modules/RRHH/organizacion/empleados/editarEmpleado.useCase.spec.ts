//test/modules/RRHH/organizacion/empleados/editarEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { EditarEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/editarEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EditarEmpleadoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso EditarEmpleadoUseCase.
 * Se verifica que el caso de uso maneje correctamente la edición de empleados,
 * incluyendo validaciones de existencia, duplicidad de documentos y actualizaciones exitosas.
 * Se utilizan mocks para simular la interacción con PrismaService y evitar llamadas reales a la base de datos.
 */
describe('EditarEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: EditarEmpleadoUseCase;
  let prisma: PrismaService;

  //Mock de PrismaService para simular la interacción con la base de datos
  const mockPrisma = {
    empleados: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    area: { findUnique: jest.fn() },
    cargo: { findUnique: jest.fn() },
    jornada: { findUnique: jest.fn() },
    tipo_documento: { findUnique: jest.fn() },
    estado_empleado: { findUnique: jest.fn() }
  };

  //Identificador mockeado de un empleado para las pruebas
  const idEmpleado = '018f4a7c-emp-0000-0000-000000000001';

  //Mock de un empleado existente para las pruebas
  const empleadoActual = {
    id: idEmpleado,
    nro_documento: '70112233',
    nombre: 'Juan',
    apellido: 'Perez',
    area_id: 'area-uuid-1',
    cargo_id: 'cargo-uuid-1',
    jornada_id: 'jornada-uuid-1',
    activo: true,
    deleted_at: null
  };

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditarEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EditarEmpleadoUseCase>(EditarEmpleadoUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe actualizar el empleado correctamente sin cambio de documento', async () => {
      //Arrange: Simulamos que el empleado existe y que la actualización es exitosa
      const payload: EditarEmpleadoDto = { nombre: 'Juan Editado' };

      mockPrisma.empleados.findUnique.mockResolvedValue(empleadoActual);
      mockPrisma.empleados.update.mockResolvedValue({ ...empleadoActual, nombre: 'Juan Editado' });

      //Act: Ejecutamos el caso de uso con los datos de actualización
      const result = await useCase.execute(idEmpleado, payload);

      //Assert: Verificamos que el empleado fue actualizado correctamente
      expect(result.nombre).toBe('Juan Editado');
      expect(mockPrisma.empleados.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.empleados.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: idEmpleado },
        data: expect.objectContaining({ nombre: 'Juan Editado' }),
      }));
    });

    it('Debe actualizar el documento si el nuevo no colisiona con otro colaborador', async () => {
      //Arrange: Simulamos que el empleado existe y que el nuevo documento no colisiona
      const payload: EditarEmpleadoDto = { nro_documento: '99887766' };

      mockPrisma.empleados.findUnique.mockResolvedValue(empleadoActual);
      mockPrisma.empleados.findFirst.mockResolvedValue(null); // Documento disponible
      mockPrisma.empleados.update.mockResolvedValue({ ...empleadoActual, nro_documento: '99887766' });

      //Act: Ejecutamos el caso de uso con el nuevo documento
      const result = await useCase.execute(idEmpleado, payload);

      //Assert: Verificamos que la actualización se realizó correctamente
      expect(mockPrisma.empleados.findFirst).toHaveBeenCalledWith({
        where: {
          nro_documento: '99887766',
          id: { not: idEmpleado },
          deleted_at: null
        },
        select: { id: true }
      });
      expect(mockPrisma.empleados.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: idEmpleado },
        data: expect.objectContaining({ nro_documento: '99887766' }),
      }));
      expect(result.nro_documento).toBe('99887766');
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar NotFoundException si el empleado no existe o está eliminado (Soft Delete)', async () => {
      //Arrange: Simulamos que el empleado no existe o tiene baja lógica
      mockPrisma.empleados.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutamos el caso de uso y verificamos que se lance NotFoundException
      await expect(useCase.execute(idEmpleado, { nombre: 'Nuevo Nombre' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si el nuevo documento ya pertenece a otro colaborador', async () => {
      //Arrange: Simulamos que el nuevo documento colisiona con otro registro
      const payload: EditarEmpleadoDto = { nro_documento: '44556677' };

      mockPrisma.empleados.findUnique.mockResolvedValue(empleadoActual);
      mockPrisma.empleados.findFirst.mockResolvedValue({ id: 'otro-empleado-uuid' });

      //Act & Assert: Ejecutamos el caso de uso y verificamos que se rechace por documento duplicado
      await expect(useCase.execute(idEmpleado, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si se intenta reasignar a un área inactiva', async () => {
      //Arrange: Simulamos que el área destino enviada en el payload no está activa
      const payload: EditarEmpleadoDto = { area_id: 'area-inactiva-uuid' };

      mockPrisma.empleados.findUnique.mockResolvedValue(empleadoActual);
      mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-inactiva-uuid', activo: false });

      //Act & Assert: Ejecutamos el caso de uso y verificamos la excepción
      await expect(useCase.execute(idEmpleado, payload)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
    });

    it('Debe capturar errores inesperados y lanzar InternalServerErrorException', async () => {
      //Arrange: Simulamos fallo de red o timeout en PostgreSQL
      mockPrisma.empleados.findUnique.mockResolvedValue(empleadoActual);
      mockPrisma.empleados.update.mockRejectedValue(new Error('PostgreSQL Query Timeout'));

      //Act & Assert: Ejecutamos el caso de uso y verificamos que se transforme a InternalServerErrorException
      await expect(useCase.execute(idEmpleado, { nombre: 'Nombre' })).rejects.toThrow(InternalServerErrorException);
    });
  });
});