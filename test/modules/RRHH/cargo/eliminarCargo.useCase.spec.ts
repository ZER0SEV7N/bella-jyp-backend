import { PrismaService } from '@/common/prisma/prisma.service';
import { EliminarCargoUseCase } from '@/modules/RRHH/use-cases/cargos/eliminarCargo.UseCase';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('EliminarCargoUseCase', () => {
  let useCase: EliminarCargoUseCase;
  let mockPrisma = {
    cargo: { findUnique: jest.fn(), update: jest.fn() },
    empleados: { count: jest.fn() },
  };
  //configuracion del prisma
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EliminarCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EliminarCargoUseCase>(EliminarCargoUseCase);
  });

  afterEach(() => jest.clearAllMocks());
  //inciar pruebas unitarias
  it('debe aplicar el softDelte al cargo', async () => {
    //simulamos que el cargo exite y que no tiene empelados activos
    mockPrisma.cargo.findUnique.mockResolvedValue({
      id: 'cargo-id-112',
      id_area: 'area-uuid-1',
      nombre: 'Analista de Sistemas',
      descripcion: 'Encargado de soporte',
      activo: true,
      deleted_at: null,
    });
    //simulamos que no hay empleados activos con este cargo
    mockPrisma.empleados.count.mockResolvedValue(0);
    //aplicar el soft deleted al cargo
    mockPrisma.cargo.update.mockResolvedValue({
      id: 'cargo-id-112',
      id_area: 'area-uuid-1',
      nombre: 'Analista de Sistemas',
      descripcion: 'Encargado de soporte y desarrollo',
      activo: false,
      deleted_at: new Date(),
    });
    //ejecutar el caso de uso para elimnar el cargo
    const result = await useCase.execute('cargo-id-112');
    //plantear lo esperado
    expect(result.activo).toBe(false);
    expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
      where: { id: 'cargo-id-112' },
      data: expect.objectContaining({ activo: false }),
    });
  });
  it('debe cancelar el sofDelte si ya lo tiene', async () => {
    //simular la busqueda de cargo
    mockPrisma.cargo.findUnique.mockResolvedValue(null);
    //ejecutar la funcion
    await expect(useCase.execute('id-inexistente-11')).rejects.toThrow(
      NotFoundException,
    );
    //calidar que los daemas metodos no sean ejecutados
    expect(mockPrisma.empleados.count).not.toHaveBeenCalled();
    expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
  });
  it('debe cancelar el softDelte si hay empleados activos con el cargo', async () => {
    //simular que existe el cargo
    mockPrisma.cargo.findUnique.mockReturnValue({
      id: 'id-cargo-112',
      deleted_at: null,
    });
    //simular respuesta que retorna empelados activos
    mockPrisma.empleados.count.mockReturnValue(3);
    //ejecutar la tarea
    await expect(useCase.execute('id-cargo-112')).rejects.toThrow(BadRequestException);
    //prubas unitarias
    expect(mockPrisma.empleados.count).toHaveBeenCalled();
    expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    expect(mockPrisma.cargo.findUnique).toHaveBeenCalled();
  });
});
