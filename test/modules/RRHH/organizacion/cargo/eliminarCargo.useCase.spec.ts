//test/modules/RRHH/organizacion/cargo/eliminarCargo.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EstadoCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/estadoCargo.useCase';

/**
 * Pruebas unitarias para el caso de uso EstadoCargoUseCase, que maneja la desactivación y reactivación de cargos en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para los métodos desactivar() y reactivar(), cubriendo casos felices, reglas de negocio y errores esperados.
 */
describe('EstadoCargoUseCase - Pruebas Unitarias de Desactivación y Reactivación', () => {
  let useCase: EstadoCargoUseCase;
  let prisma: PrismaService;

  //Mocks de Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    cargo: { findUnique: jest.fn(), update: jest.fn() },
    empleados: {count: jest.fn() },
  };

  const idCargo = 'cargo-uuid-500';

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<EstadoCargoUseCase>(EstadoCargoUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('desactivar() - Soft Delete y Bloqueo por Empleados Asignados', () => {
    it('Happy Path: Debe aplicar Soft Delete y marcar activo=false si no hay colaboradores activos asignados', async () => {
      //Arrange: Simular que el cargo existe y no tiene empleados activos asignados
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        nombre: 'Asistente Administrativo',
        activo: true,
        deleted_at: null
      });

      //Simular que no hay empleados activos asignados al cargo
      mockPrisma.empleados.count.mockResolvedValue(0);
      mockPrisma.cargo.update.mockResolvedValue({
        id: idCargo,
        activo: false,
        deleted_at: new Date()
      });

      //Act: Ejecutar la use case para desactivar el cargo
      const resultado = await useCase.desactivar(idCargo);

      //Assert: Verificar que el cargo fue desactivado correctamente y que se realizaron las llamadas esperadas a Prisma
      expect(resultado).toBeDefined();
      expect(resultado.id).toBe(idCargo);
      expect(resultado.deleted_at).toBeInstanceOf(Date);
      expect(resultado.activo).toBe(false);
      expect(mockPrisma.empleados.count).toHaveBeenCalledWith({
        where: {
          cargo_id: idCargo,
          activo: true,
          deleted_at: null
        }
      });
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
        where: { id: idCargo },
        data: expect.objectContaining({ activo: false })
      });
    });

    it('Regla de Negocio: Debe bloquear la desactivación con BadRequestException si hay empleados activos ocupando el cargo', async () => {
      //Arrange: Simular que el cargo existe y tiene empleados activos asignados
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        activo: true,
        deleted_at: null
      });
      mockPrisma.empleados.count.mockResolvedValue(4); //4 empleados activos

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.desactivar(idCargo)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el cargo no existe o ya se encuentra eliminado', async () => {
      //Arrange: Simular que el cargo no existe o ya está eliminado
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.desactivar(idCargo)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.empleados.count).not.toHaveBeenCalled();
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });
  });

  describe('reactivar() - Restauración de Cargo Desactivado', () => {
    it('Happy Path: Debe reactivar el cargo restableciendo activo=true y deleted_at=null', async () => {
      //Arrange: Simular que el cargo existe y está desactivado
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        activo: false,
        deleted_at: new Date('2026-01-01')
      });

      //Simular la actualización exitosa del cargo al reactivarlo
      const cargoRestaurado = {
        id: idCargo,
        activo: true,
        deleted_at: null,
        area: { id: 'area-1', nombre: 'Logística' },
        jornada_sugerida: null,
      };

      //Simular la respuesta de Prisma al reactivar el cargo
      mockPrisma.cargo.update.mockResolvedValue(cargoRestaurado);

      //Act: Ejecutar la use case para reactivar el cargo
      const resultado = await useCase.reactivar(idCargo);

      //Assert: Verificar que el cargo fue reactivado correctamente y que se realizaron las llamadas esperadas a Prisma
      expect(resultado).toBeDefined();
      expect(resultado.id).toBe(idCargo);
      expect(resultado.activo).toBe(true);
      expect(resultado.deleted_at).toBeNull();
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
        where: { id: idCargo },
        data: { activo: true, deleted_at: null },
        include: {
          area: { select: { id: true, nombre: true } },
          jornada_sugerida: { select: { id: true, nombre: true, tipo_jornada: true } }
        }
      });
    });

    it('Debe lanzar NotFoundException si el cargo a reactivar no existe en BD', async () => {
      //Arrange: Simular que el cargo no existe en la base de datos
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.reactivar(idCargo)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar InternalServerErrorException si la base de datos falla al reactivar', async () => {
      //Arrange: Simular que el cargo existe en BD
      mockPrisma.cargo.findUnique.mockResolvedValue({ id: idCargo });
      mockPrisma.cargo.update.mockRejectedValue(new Error('Conexión perdida'));

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.reactivar(idCargo)).rejects.toThrow(InternalServerErrorException);
    });
  });
});