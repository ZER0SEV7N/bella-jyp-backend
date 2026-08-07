//test/modules/RRHH/area/area.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AreaController } from '@/modules/RRHH/controller/Area.controller';
import { CrearAreaUseCase } from '@/modules/RRHH/use-cases/area/crearArea.useCase';
import { ActualizarAreaUseCase } from '@/modules/RRHH/use-cases/area/actualizarArea.useCase';
import { EliminarAreaUseCase } from '@/modules/RRHH/use-cases/area/eliminarArea.useCase';
import { ActiveAreaUseCase } from '@/modules/RRHH/use-cases/area/activeArea.useCase';
import { ListarAreasUseCase } from '@/modules/RRHH/use-cases/area/listarAreas.useCase';

//Prueba unitaria para el AreaController
describe('AreaController', () => {
  //Declaración de variables para el controlador y los casos de uso
  let controller: AreaController;

  //Mockear todos los casos de uso para evitar dependencias externas
  const mockCrearAreaUC = { execute: jest.fn() };
  const mockActualizarAreaUC = { execute: jest.fn() };
  const mockEliminarAreaUC = { execute: jest.fn() };
  const mockActiveAreaUC = { execute: jest.fn() };
  const mockListarAreasUC = { listar: jest.fn() };

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AreaController],
      providers: [
        { provide: CrearAreaUseCase, useValue: mockCrearAreaUC },
        { provide: ActualizarAreaUseCase, useValue: mockActualizarAreaUC },
        { provide: EliminarAreaUseCase, useValue: mockEliminarAreaUC },
        { provide: ActiveAreaUseCase, useValue: mockActiveAreaUC },
        { provide: ListarAreasUseCase, useValue: mockListarAreasUC },
      ],
    }).compile();
    controller = module.get<AreaController>(AreaController);
  });

  afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

  //=============================================
  //Endpoint: Crear Area
  //=============================================
  it('crear(): Debería llamar a CrearAreaUseCase con el payload', async () => {
    //Arrange
    const payload = { nombre: 'Sistemas' };
    mockCrearAreaUC.execute.mockResolvedValue({ id: '1', ...payload });

    const result = await controller.crear(payload);

    expect(result.id).toBe('1');
    expect(mockCrearAreaUC.execute).toHaveBeenCalledWith(payload);
  });

  it('crear(): Debería lanzar un error si CrearAreaUseCase falla', async () => {
    //Arrange
    const payload = { nombre: 'Sistemas' };
    mockCrearAreaUC.execute.mockRejectedValue(new Error('Error al crear'));

    //Act & Assert
    await expect(controller.crear(payload)).rejects.toThrow('Error al crear');
    expect(mockCrearAreaUC.execute).toHaveBeenCalledWith(payload);
  });

  //=============================================
  //Endpoint: Actualizar Area
  //=============================================
  it('update(): Debería llamar a ActualizarAreaUseCase con el ID y payload', async () => {
    const id = 'uuid-123';
    const payload = { nombre: 'Sistemas V2' };
    mockActualizarAreaUC.execute.mockResolvedValue({ id, ...payload });

    const result = await controller.update(id, payload);

    expect(result.nombre).toBe('Sistemas V2');
    expect(mockActualizarAreaUC.execute).toHaveBeenCalledWith(id, payload);
  });

  it('update(): Debería lanzar un error si ActualizarAreaUseCase falla', async () => {
    //Arrange
    const id = 'uuid-123';
    const payload = { nombre: 'Sistemas V2' };
    mockActualizarAreaUC.execute.mockRejectedValue(
      new Error('Error al actualizar'),
    );

    //Act & Assert
    await expect(controller.update(id, payload)).rejects.toThrow(
      'Error al actualizar',
    );
    expect(mockActualizarAreaUC.execute).toHaveBeenCalledWith(id, payload);
  });

  it('update(): Debería lanzar un error si el ID no es un UUID válido', async () => {
    //Arrange
    const invalidId = 'invalid-uuid';
    const payload = { nombre: 'Sistemas V2' };

    //Act & Assert
    await expect(controller.update(invalidId, payload)).rejects.toThrow();
    expect(mockActualizarAreaUC.execute).toHaveBeenCalledWith(
      invalidId,
      payload,
    );
  });

  //=============================================
  //Endpoint: Reactivar Area
  //=============================================
  it('reactive(): Debería llamar a ActiveAreaUseCase con el ID', async () => {
    //Arrange
    const id = 'uuid-123';
    mockActiveAreaUC.execute.mockResolvedValue({
      state: true,
      message: 'Reactivado',
    });

    //Act
    const result = await controller.reactive(id);

    //Assert
    expect(result.state).toBe(true);
    expect(mockActiveAreaUC.execute).toHaveBeenCalledWith(id);
  });

  it('reactive(): Debería lanzar un error si ActiveAreaUseCase falla', async () => {
    //Arrange
    const id = 'uuid-123';
    mockActiveAreaUC.execute.mockRejectedValue(new Error('Error al reactivar'));

    //Act & Assert
    await expect(controller.reactive(id)).rejects.toThrow('Error al reactivar');
    expect(mockActiveAreaUC.execute).toHaveBeenCalledWith(id);
  });

  it('reactive(): Deberia lanzar un error si el area esta activada', async () => {
    //Arrange
    const id = 'uuid-123';
    mockActiveAreaUC.execute.mockRejectedValue(
      new Error('El área ya está activada'),
    );

    //Act & Assert
    await expect(controller.reactive(id)).rejects.toThrow(
      'El área ya está activada',
    );
    expect(mockActiveAreaUC.execute).toHaveBeenCalledWith(id);
  });

  //=============================================
  //Endpoint: Eliminar Area
  //=============================================
  it('eliminar(): Debería llamar a EliminarAreaUseCase con el ID', async () => {
    const id = 'uuid-123';
    mockEliminarAreaUC.execute.mockResolvedValue({ activo: false });

    const result = await controller.eliminar(id);

    expect(result.activo).toBe(false);
    expect(mockEliminarAreaUC.execute).toHaveBeenCalledWith(id);
  });

  it('eliminar(): Debería lanzar un error si EliminarAreaUseCase falla', async () => {
    const id = 'uuid-123';
    mockEliminarAreaUC.execute.mockRejectedValue(
      new Error('Error al eliminar'),
    );

    //Act & Assert
    await expect(controller.eliminar(id)).rejects.toThrow('Error al eliminar');
    expect(mockEliminarAreaUC.execute).toHaveBeenCalledWith(id);
  });

  it('eliminar(): Deberia lanzar error si el area ya esta desactivada', async () => {
    const id = 'uuid-123';
    mockEliminarAreaUC.execute.mockRejectedValue(
      new Error('El área ya está desactivada'),
    );

    //Act & Assert
    await expect(controller.eliminar(id)).rejects.toThrow(
      'El área ya está desactivada',
    );
    expect(mockEliminarAreaUC.execute).toHaveBeenCalledWith(id);
  });

  //=============================================
  //Endpoint: Listar Areas
  //=============================================
  it('listarAreas(): Debería llamar a ListarAreasUseCase con los QueryParams', async () => {
    const query = { page: 1, limit: 10, activo: true };
    mockListarAreasUC.listar.mockResolvedValue({ data: [], meta: {} });

    const result = await controller.listarAreas(query);

    expect(result.data).toBeDefined();
    expect(mockListarAreasUC.listar).toHaveBeenCalledWith(query);
  });

  it('listarAreas(): Debería lanzar un error si ListarAreasUseCase falla', async () => {
    const query = { page: 1, limit: 10, activo: true };
    mockListarAreasUC.listar.mockRejectedValue(new Error('Error al listar'));

    //Act & Assert
    await expect(controller.listarAreas(query)).rejects.toThrow(
      'Error al listar',
    );
    expect(mockListarAreasUC.listar).toHaveBeenCalledWith(query);
  });

  it('listarAreas(): Debería lanzar un error si los QueryParams son inválidos', async () => {
    const invalidQuery = { page: -1, limit: 0 } as any; // Forzando un tipo inválido
    mockListarAreasUC.listar.mockRejectedValue(
      new Error('Parámetros de consulta inválidos'),
    );
    //Act & Assert
    await expect(controller.listarAreas(invalidQuery)).rejects.toThrow(
      'Parámetros de consulta inválidos',
    );
    expect(mockListarAreasUC.listar).toHaveBeenCalledWith(invalidQuery);
  });
});
