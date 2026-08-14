//test/modules/RRHH/cargo/actualizarCargo.useCase.spec.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ActualizarCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/actualizarCargo.UseCase';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { ActualizarCargoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso ActualizarCargoUseCase.
 */
describe('ActualizarCargoUseCase', () => {
  let useCase: ActualizarCargoUseCase;
  let mockPrisma = {
    cargo: { findUnique: jest.fn(), update: jest.fn() },
    area: { findUnique: jest.fn() }
  };

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    //simular modulo
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActualizarCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<ActualizarCargoUseCase>(ActualizarCargoUseCase);
  });

  afterEach(() => jest.clearAllMocks()); //limpiar los mocks despues de cada prueba
  
  it('debe actulizar cualquier atributo del cargo sin cambiar el area', async () => {
    //Arrange: Datos simulados
    const idCargo = 'id-cargo-actualizar';
    const cargoActual = {
      id: idCargo,
      descripcion: 'actual descripcion',
      nombre: 'actual nombre',
      id_area: 'id-sin-cambios',
      activo: true,
      deleted_at: null
    };

    //Payload de actualización
    const payload = {
      descripcion: 'nueva descripcion',
      nombre: 'nuevo nombre',
      id_area: 'id-sin-cambios'
    } as ActualizarCargoDto;

    //Act: Simular resultados de Prisma y ejecutar la use case
    const CargoActulizado = {...cargoActual, ...payload};
    mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
    mockPrisma.cargo.update.mockResolvedValue(CargoActulizado);
    const resultado = await useCase.execute(idCargo, payload);

    //Assert: Verificar resultados y llamadas a Prisma
    expect(resultado).toBe(CargoActulizado);
    expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.cargo.findUnique).toHaveBeenCalled();
    expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
      where: { id: idCargo },
      data: { ...payload }
    });
  });


  it('debe actualizar el cargo junto con su área', async () => {
    //Arrange: Datos simulados
    const idCargo = 'id-cargo-actualizar';

    const cargoActual = {
      id: idCargo,
      descripcion: 'actual descripcion',
      nombre: 'actual nombre',
      id_area: 'id-sin-cambios',
      activo: true,
      deleted_at: null
    };

    const payload = {
      descripcion: 'nueva descripcion',
      nombre: 'nuevo nombre',
      id_area: 'id-con-cambios'
    } as ActualizarCargoDto;

    //Act: Simular resultados de Prisma y ejecutar la use case
    const cargoActualizado = { ...cargoActual, ...payload };

    mockPrisma.cargo.findUnique.mockResolvedValueOnce(cargoActual);
    mockPrisma.area.findUnique.mockResolvedValueOnce({
      id: 'id-con-cambios',
      activo: true,
      deleted_at: null
    });
    mockPrisma.cargo.update.mockResolvedValueOnce(cargoActualizado);
    //Act: Ejecutar la use case
    const resultado = await useCase.execute(idCargo, payload);

    //Assert: Verificar resultados y llamadas a Prisma
    expect(resultado).toEqual(cargoActualizado);
    expect(mockPrisma.cargo.findUnique).toHaveBeenCalledWith({where: { id: idCargo }});
    expect(mockPrisma.area.findUnique).toHaveBeenCalledWith({where: { id: 'id-con-cambios' }});
    expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
      where: { id: idCargo },
      data: { ...payload }
    });
  });

  it('debe lanzar NotFoundException si el cargo no existe', async () => {
    const idCargo = 'id-cargo-inexistente';
    const payload = { nombre: 'nuevo nombre' } as ActualizarCargoDto;

    mockPrisma.cargo.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute(idCargo, payload)).rejects.toThrow(NotFoundException);

    expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException si el cargo ya fue eliminado', async () => {
    const idCargo = 'id-cargo-eliminado';
    const payload = { nombre: 'nuevo nombre' } as ActualizarCargoDto;

    mockPrisma.cargo.findUnique.mockResolvedValueOnce({deleted_at: new Date()});

    await expect(useCase.execute(idCargo, payload)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
  });

  it('debe lanzar BadRequestException si el área destino no existe', async () => {
    const idCargo = 'id-cargo-actualizar';
    const payload = { id_area: 'id-area-no-existe' } as ActualizarCargoDto;

    mockPrisma.cargo.findUnique.mockResolvedValueOnce({
      id_area: 'id-sin-cambios',
      deleted_at: null
    });
    mockPrisma.area.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
  });

  it('debe lanzar BadRequestException si el área destino está inactiva', async () => {
    const idCargo = 'id-cargo-actualizar';
    const payload = { id_area: 'id-area-inactiva' } as ActualizarCargoDto;

    mockPrisma.cargo.findUnique.mockResolvedValueOnce({
      id_area: 'id-sin-cambios',
      deleted_at: null
    });
    mockPrisma.area.findUnique.mockResolvedValueOnce({ activo: false });

    await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
  });

  it('debe envolver un error inesperado en BadRequestException genérico', async () => {
    const idCargo = 'id-cargo-actualizar';
    const payload = { nombre: 'nuevo nombre' } as ActualizarCargoDto;

    mockPrisma.cargo.findUnique.mockResolvedValueOnce({
      id_area: 'id-sin-cambios',
      deleted_at: null
    });
    mockPrisma.cargo.update.mockRejectedValueOnce(new Error('DB caída'));

    await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.cargo.update).toHaveBeenCalled();
  });
});
