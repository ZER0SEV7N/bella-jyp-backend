jest.mock('@/modules/core/usuarios/decorators/usuarios-swagger.decorators', () => ({
  ApiSwaggerUsuariosController: () => () => undefined,
  ApiSwaggerObtenerMiPerfil: () => () => undefined,
  ApiSwaggerListarUsuarios: () => () => undefined,
  ApiSwaggerCambiarEstado: () => () => undefined,
  ApiSwaggerCambiarRol: () => () => undefined,
  ApiSwaggerCambiarMiPassword: () => () => undefined,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosController } from '@/modules/core/usuarios/controller/usuarios.controller';
import { ObtenerMiPerfilUseCase } from '@/modules/core/usuarios/use-cases/obtenerMiPerfil.useCase';
import { GestionUsuariosUseCase } from '@/modules/core/usuarios/use-cases/gestionarUsuarios.useCase';
import { CambiarMiPasswordUseCase } from '@/modules/core/usuarios/use-cases/cambiarMiPassword.useCase';

describe('UsuariosController', () => {
  let controller: UsuariosController;

  const mockObtenerMiPerfilUC = { obtenerPerfil: jest.fn() };
  const mockGestionUsuariosUC = {
    listar: jest.fn(),
    cambiarEstado: jest.fn(),
    cambiarRol: jest.fn(),
  };
  const mockCambiarMiPasswordUC = { cambiarMiPassword: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [
        { provide: ObtenerMiPerfilUseCase, useValue: mockObtenerMiPerfilUC },
        { provide: GestionUsuariosUseCase, useValue: mockGestionUsuariosUC },
        {
          provide: CambiarMiPasswordUseCase,
          useValue: mockCambiarMiPasswordUC,
        },
      ],
    }).compile();

    controller = module.get(UsuariosController);
  });

  it('obtiene el perfil usando el ID del usuario autenticado', async () => {
    // Arrange
    const req = {
      user: { id: 'user-123' },
    } as unknown as Parameters<UsuariosController['obtenerMiPerfil']>[0];
    const perfil = { id: 'user-123', email: 'test@jyp.com' };
    mockObtenerMiPerfilUC.obtenerPerfil.mockResolvedValue(perfil);

    // Act
    const resultado = await controller.obtenerMiPerfil(req);

    // Assert
    expect(resultado).toEqual(perfil);
    expect(mockObtenerMiPerfilUC.obtenerPerfil).toHaveBeenCalledWith('user-123');
  });

  it('propaga los errores al obtener el perfil', async () => {
    // Arrange
    const req = {
      user: { id: 'user-123' },
    } as unknown as Parameters<UsuariosController['obtenerMiPerfil']>[0];
    mockObtenerMiPerfilUC.obtenerPerfil.mockRejectedValue(
      new Error('Error inesperado'),
    );

    // Act & Assert
    await expect(controller.obtenerMiPerfil(req)).rejects.toThrow(
      'Error inesperado',
    );
  });

  it('lista usuarios con los filtros recibidos', async () => {
    // Arrange
    const query = { page: 2, limit: 10 } as Parameters<
      UsuariosController['listarUsuarios']
    >[0];
    const resultado = { data: [], total: 0 };
    mockGestionUsuariosUC.listar.mockResolvedValue(resultado);

    // Act
    const respuesta = await controller.listarUsuarios(query);

    // Assert
    expect(respuesta).toEqual(resultado);
    expect(mockGestionUsuariosUC.listar).toHaveBeenCalledWith(query);
  });

  it('cambia el estado del usuario con el actor autenticado', async () => {
    // Arrange
    const id = 'user-123';
    const body = { activo: false } as Parameters<
      UsuariosController['cambiarEstado']
    >[1];
    const req = {
      user: { id: 'admin-1', rol: 'ADMIN' },
    } as unknown as Parameters<UsuariosController['cambiarEstado']>[2];
    const resultado = { id, activo: false };
    mockGestionUsuariosUC.cambiarEstado.mockResolvedValue(resultado);

    // Act
    const respuesta = await controller.cambiarEstado(id, body, req);

    // Assert
    expect(respuesta).toEqual(resultado);
    expect(mockGestionUsuariosUC.cambiarEstado).toHaveBeenCalledWith(
      id,
      false,
      req.user,
    );
  });

  it('cambia el rol del usuario con el actor autenticado', async () => {
    // Arrange
    const id = 'user-123';
    const body = { rol: 'RRHH' } as Parameters<
      UsuariosController['cambiarRol']
    >[1];
    const req = {
      user: { id: 'admin-1', rol: 'ADMIN' },
    } as unknown as Parameters<UsuariosController['cambiarRol']>[2];
    const resultado = { id, rol: 'RRHH' };
    mockGestionUsuariosUC.cambiarRol.mockResolvedValue(resultado);

    // Act
    const respuesta = await controller.cambiarRol(id, body, req);

    // Assert
    expect(respuesta).toEqual(resultado);
    expect(mockGestionUsuariosUC.cambiarRol).toHaveBeenCalledWith(
      id,
      'RRHH',
      req.user,
    );
  });

  it('cambia la contraseña del usuario autenticado', async () => {
    // Arrange
    const body = {
      password_actual: 'actual',
      nueva_password: 'nueva',
    };
    const req = {
      user: { id: 'user-123' },
    } as unknown as Parameters<UsuariosController['cambiarMiPassword']>[1];
    const resultado = { message: 'Contraseña actualizada' };
    mockCambiarMiPasswordUC.cambiarMiPassword.mockResolvedValue(resultado);

    // Act
    const respuesta = await controller.cambiarMiPassword(body, req);

    // Assert
    expect(respuesta).toEqual(resultado);
    expect(mockCambiarMiPasswordUC.cambiarMiPassword).toHaveBeenCalledWith(
      'user-123',
      'actual',
      'nueva',
    );
  });
});