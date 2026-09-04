import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EstadoCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/estadoCargo.useCase';

/**
 * Pruebas unitarias para el caso de uso EstadoCargoUseCase, que maneja la desactivación y reactivación de cargos en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para los métodos desactivar() y reactivar(), cubriendo reglas de bloqueo por empleados asignados y validación del área matriz.
 */
describe('EstadoCargoUseCase - Pruebas Unitarias de Desactivación y Reactivación', () => {
  let useCase: EstadoCargoUseCase;
  let prisma: PrismaService;

  const mockPrisma = {
    cargo: { findUnique: jest.fn(), update: jest.fn() },
    area: { findUnique: jest.fn() },
    empleados: { count: jest.fn() },
  };

  const idCargo = 'cargo-uuid-500';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EstadoCargoUseCase>(EstadoCargoUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // Restablece también las implementaciones para evitar que los mocks de un
  // caso anterior (por ejemplo, cargo.update) afecten a los siguientes.
  afterEach(() => jest.resetAllMocks());

  describe('desactivar() - Soft Delete y Bloqueo por Empleados Asignados', () => {
    it('Happy Path: Debe aplicar Soft Delete y marcar activo=false si no hay colaboradores activos asignados', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        nombre: 'Asistente Administrativo',
        activo: true,
        deleted_at: null,
      });

      mockPrisma.empleados.count.mockResolvedValue(0);
      mockPrisma.cargo.update.mockResolvedValue({
        id: idCargo,
        activo: false,
        deleted_at: new Date(),
      });

      const resultado = await useCase.desactivar(idCargo);

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
        data: expect.objectContaining({ activo: false }),
      });
    });

    it('Regla de Negocio: Debe bloquear la desactivación con BadRequestException si hay empleados activos ocupando el cargo', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        nombre: 'Supervisor Operativo',
        activo: true,
        deleted_at: null,
      });
      mockPrisma.empleados.count.mockResolvedValue(4); // 4 empleados activos

      await expect(useCase.desactivar(idCargo)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el cargo no existe o ya se encuentra eliminado', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      await expect(useCase.desactivar(idCargo)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.empleados.count).not.toHaveBeenCalled();
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });
  });

  describe('reactivar() - Restauración de Cargo Desactivado', () => {
    it('Happy Path: Debe reactivar el cargo restableciendo activo=true y deleted_at=null si el área matriz está activa', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        id_area: 'area-uuid-1',
        activo: false,
        deleted_at: new Date('2026-01-01'),
      });

      // El área a la que pertenece el cargo está activa
      mockPrisma.area.findUnique.mockResolvedValue({
        id: 'area-uuid-1',
        nombre: 'Logística',
        activo: true,
        deleted_at: null,
      });

      const cargoRestaurado = {
        id: idCargo,
        activo: true,
        deleted_at: null,
        area: { id: 'area-uuid-1', nombre: 'Logística' },
      };

      mockPrisma.cargo.update.mockResolvedValue(cargoRestaurado);

      const resultado = await useCase.reactivar(idCargo);

      expect(resultado.activo).toBe(true);
      expect(resultado.deleted_at).toBeNull();
      expect(mockPrisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: 'area-uuid-1', deleted_at: null },
      });
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
        where: { id: idCargo },
        data: { activo: true, deleted_at: null },
        include: { area: { select: { id: true, nombre: true } } },
      });
    });

    it('Regla de Negocio: Debe bloquear con BadRequestException si el cargo ya se encuentra activo', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        nombre: 'Cargo Activo',
        activo: true,
        deleted_at: null,
      });

      await expect(useCase.reactivar(idCargo)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Regla de Negocio: Debe bloquear con BadRequestException si el área matriz se encuentra inactiva o eliminada', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue({
        id: idCargo,
        id_area: 'area-uuid-inactiva',
        activo: false,
        deleted_at: new Date('2026-01-01'),
      });

      mockPrisma.area.findUnique.mockResolvedValue(null);

      await expect(useCase.reactivar(idCargo)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el cargo a reactivar no existe en BD', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      await expect(useCase.reactivar(idCargo)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar InternalServerErrorException si la base de datos falla al reactivar', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue({ id: idCargo, id_area: 'area-1', activo: false, deleted_at: new Date() });
      mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-1', activo: true, deleted_at: null });
      mockPrisma.cargo.update.mockRejectedValue(new Error('Conexión perdida'));

      await expect(useCase.reactivar(idCargo)).rejects.toThrow(InternalServerErrorException);
    });
  });
});