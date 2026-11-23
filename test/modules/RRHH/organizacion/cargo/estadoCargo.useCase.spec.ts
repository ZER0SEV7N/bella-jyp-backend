//test/modules/RRHH/organizacion/cargo/estadoCargo.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EstadoCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/estadoCargo.useCase';

/**
 * Pruebas unitarias para el caso de uso EstadoCargoUseCase, que maneja la desactivación y reactivación de cargos en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para los métodos desactivar() y reactivar(), cubriendo reglas de bloqueo por empleados asignados y validación del área matriz.
 */
describe('EstadoCargoUseCase - Pruebas Unitarias de Desactivación y Reactivación', () => {
  let useCase: EstadoCargoUseCase;

  //Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    cargo: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    area: { findUnique: jest.fn() },
    empleados: { count: jest.fn() },
  };

  //IdCargo de prueba para un cargo existente
  const idCargo = 'cargo-uuid-500';

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EstadoCargoUseCase>(EstadoCargoUseCase);
  });

  //Limpiar los mocks después de cada test para evitar interferencias entre pruebas
  afterEach(() => jest.resetAllMocks());

  describe('desactivar() - Soft Delete y Bloqueo por Empleados Asignados', () => {
    it('Happy Path: Debe aplicar Soft Delete y marcar activo=false si no hay colaboradores activos asignados', async () => {
      //Arrange: Simular que el cargo existe y no tiene empleados activos asignados
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        nombre: 'Asistente Administrativo',
        activo: true,
        deleted_at: null,
      });

      //Simular que no hay empleados activos asignados al cargo
      mockPrisma.empleados.count.mockResolvedValue(0);
      mockPrisma.cargo.update.mockResolvedValue({
        id: idCargo,
        activo: false,
        deleted_at: new Date(),
      });

      //Act: Ejecutar el caso de uso para desactivar el cargo
      const resultado = await useCase.desactivar(idCargo);

      //Assert: Verificar que se aplicó soft delete y que se llamó a los métodos de Prisma con los parámetros correctos
      expect(resultado.id).toBe(idCargo);
      expect(resultado.deleted_at).toBeInstanceOf(Date);
      expect(resultado.activo).toBe(false);
      expect(mockPrisma.empleados.count).toHaveBeenCalledWith({
        where: {
          cargo_id: idCargo,
          activo: true,
          deleted_at: null,
        },
      });
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
        where: { id: idCargo },
        data: expect.objectContaining({ activo: false }) as unknown,
      });
    });

    it('Regla de Negocio: Debe bloquear la desactivación con BadRequestException si hay empleados activos ocupando el cargo', async () => {
      //Arrange: Simular que el cargo existe y tiene empleados activos asignados
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        nombre: 'Supervisor Operativo',
        activo: true,
        deleted_at: null,
      });
      mockPrisma.empleados.count.mockResolvedValue(4); //4 empleados activos

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance BadRequestException
      await expect(useCase.desactivar(idCargo)).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el cargo no existe o ya se encuentra eliminado', async () => {
      //Arrange: Simular que el cargo no existe en la base de datos
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance NotFoundException
      await expect(useCase.desactivar(idCargo)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.empleados.count).not.toHaveBeenCalled();
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });
  });

  describe('reactivar() - Restauración de Cargo Desactivado', () => {
    it('Happy Path: Debe reactivar el cargo restableciendo activo=true y deleted_at=null si el área matriz está activa', async () => {
      //Arrange: Simular que el cargo existe y está desactivado, y que el área matriz está activa
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        id_area: 'area-uuid-1',
        nombre: 'Asistente Logístico',
        activo: false,
        deleted_at: new Date('2026-01-01'),
      });

      //El área a la que pertenece el cargo está activa
      mockPrisma.area.findUnique.mockResolvedValue({
        id: 'area-uuid-1',
        nombre: 'Logística',
        activo: true,
        deleted_at: null,
      });

      //Simular la reactivación exitosa del cargo
      const cargoRestaurado = {
        id: idCargo,
        activo: true,
        deleted_at: null,
        area: { id: 'area-uuid-1', nombre: 'Logística' },
      };

      //Mock de la actualización del cargo para reactivarlo sin colisión de nombre activo
      mockPrisma.cargo.findFirst.mockResolvedValue(null);
      mockPrisma.cargo.update.mockResolvedValue(cargoRestaurado);

      //Act: Ejecutar el caso de uso para reactivar el cargo
      const resultado = await useCase.reactivar(idCargo);

      //Assert: Verificar que se reactivó correctamente y que se llamó a los métodos de Prisma con los parámetros correctos
      expect(resultado.activo).toBe(true);
      expect(resultado.deleted_at).toBeNull();
      expect(mockPrisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: 'area-uuid-1', deleted_at: null },
        select: { id: true, activo: true },
      });
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
        where: { id: idCargo },
        data: { activo: true, deleted_at: null },
        include: { area: { select: { id: true, nombre: true } } },
      });
    });

    it('Regla de Negocio: Debe bloquear con BadRequestException si el cargo ya se encuentra activo', async () => {
      //Arrange: Simular que el cargo ya está activo
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        nombre: 'Cargo Activo',
        activo: true,
        deleted_at: null,
      });

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance BadRequestException
      await expect(useCase.reactivar(idCargo)).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Regla de Negocio: Debe lanzar NotFoundException si el área matriz se encuentra inactiva o eliminada', async () => {
      //Arrange: Simular que el cargo existe y está desactivado, pero el área matriz está inactiva
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        id_area: 'area-uuid-inactiva',
        activo: false,
        deleted_at: new Date('2026-01-01'),
      });

      //Simular que el área matriz está inactiva
      mockPrisma.area.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance NotFoundException
      await expect(useCase.reactivar(idCargo)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el cargo a reactivar no existe en BD', async () => {
      //Arrange: Simular que el cargo no existe en la base de datos
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance NotFoundException
      await expect(useCase.reactivar(idCargo)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar InternalServerErrorException si la base de datos falla al reactivar', async () => {
      //Arrange: Simular que el cargo existe y está desactivado, y que el área matriz está activa
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        id_area: 'area-1',
        nombre: 'Cargo Prueba',
        activo: false,
        deleted_at: new Date(),
      });
      mockPrisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        activo: true,
        deleted_at: null,
      });
      mockPrisma.cargo.findFirst.mockResolvedValue(null);
      mockPrisma.cargo.update.mockRejectedValue(new Error('Conexión perdida'));

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance InternalServerErrorException
      await expect(useCase.reactivar(idCargo)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('Debe lanzar ConflictException si ya existe otro cargo activo con el mismo nombre', async () => {
      //Arrange: Simular cargo inactivo, área matriz activa y colisión con otro cargo activo
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        id_area: 'area-1',
        nombre: 'Asistente Contable',
        activo: false,
        deleted_at: new Date('2026-01-01'),
      });
      mockPrisma.area.findUnique.mockResolvedValue({
        id: 'area-1',
        activo: true,
        deleted_at: null,
      });
      mockPrisma.cargo.findFirst.mockResolvedValue({
        id: 'otro-cargo-activo',
      });

      //Act & Assert: Verificar que se lance ConflictException y no se actualice
      await expect(useCase.reactivar(idCargo)).rejects.toThrow(
        ConflictException
      );
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });
  });
});
