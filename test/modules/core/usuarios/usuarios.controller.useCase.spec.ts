//test/modules/core/usuarios/usuarios.controller.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosController } from '@/modules/core/usuarios/controller/usuarios.controller';
import { ObtenerMiPerfilUseCase } from '@/modules/core/usuarios/use-cases/obtenerMiPerfil.useCase';

/**
 * Pruebas unitarias para el controlador UsuariosController
 * Se mockean los casos de uso para aislar la lógica del controlador y evitar dependencias externas.
 * Esto permite probar únicamente la interacción entre el controlador y los casos de uso.
 */
describe('UsuariosController', () => {
  let controller: UsuariosController;
  let mockObtenerMiPerfilUC: any;

  beforeEach(async () => {
    mockObtenerMiPerfilUC = { obtenerPerfil: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [
        { provide: ObtenerMiPerfilUseCase, useValue: mockObtenerMiPerfilUC },
      ],
    }).compile();

    controller = module.get<UsuariosController>(UsuariosController);
  });

  afterEach(() => jest.clearAllMocks());

  it('obtenerMiPerfil(): Debería extraer el ID del request y retornar el perfil', async () => {
    //Arrange: Simulamos lo que JwtStrategy inyecta en req.user
    const mockReq = { user: { id: 'user-123' } } as any;
    const mockProfile = { id: 'user-123', email: 'test@jyp.com' };
    mockObtenerMiPerfilUC.obtenerPerfil.mockResolvedValue(mockProfile);

    //Act
    const result = await controller.obtenerMiPerfil(mockReq);

    //Assert
    expect(result).toEqual(mockProfile);
    expect(mockObtenerMiPerfilUC.obtenerPerfil).toHaveBeenCalledWith(
      'user-123',
    );
  });

  it('obtenerMiPerfil(): Debería lanzar un error si ObtenerMiPerfilUseCase falla', async () => {
    //Arrange
    const mockReq = { user: { id: 'user-123' } } as any;
    mockObtenerMiPerfilUC.obtenerPerfil.mockRejectedValue(
      new Error('Error inesperado'),
    );

    //Act & Assert
    await expect(controller.obtenerMiPerfil(mockReq)).rejects.toThrow(
      'Error inesperado',
    );
    expect(mockObtenerMiPerfilUC.obtenerPerfil).toHaveBeenCalledWith(
      'user-123',
    );
  });

  it('obtenerMiPerfil(): Debería lanzar un error si req.user.id no está presente', async () => {
    //Arrange: Simulamos un request sin user.id
    const mockReq = { user: {} } as any;

    //Act & Assert
    await expect(controller.obtenerMiPerfil(mockReq)).resolves.toBeUndefined();
    expect(mockObtenerMiPerfilUC.obtenerPerfil).toHaveBeenCalledWith(undefined);
  });
});
