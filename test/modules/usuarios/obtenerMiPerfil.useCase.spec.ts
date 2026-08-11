//test/modules/usuarios/obtenerMiPerfil.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ObtenerMiPerfilUseCase } from '@/modules/usuarios/use-cases/obtenerMiPerfil.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso ObtenerMiPerfilUseCase
 */
describe('ObtenerMiPerfilUseCase', () => {
  let useCase: ObtenerMiPerfilUseCase;
  let mockPrisma: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = { usuarios: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObtenerMiPerfilUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ObtenerMiPerfilUseCase>(ObtenerMiPerfilUseCase);
  });

  afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

  it('Debería retornar el perfil formateado correctamente (Happy Path)', async () => {
    //Arrange
    const mockDbUser = {
      id: 'user-123',
      email: 'test@jyp.com',
      rol: 'ADMIN',
      ultimo_acceso: new Date('2026-08-05T10:00:00Z'),
      empleados: {
        id: 'emp-123',
        nro_documento: '70112233',
        nombre: 'Juan',
        apellido: 'Perez',
        cargo: { nombre: 'Gerente' },
        area: { nombre: 'Sistemas' },
      },
    };
    mockPrisma.usuarios.findUnique.mockResolvedValue(mockDbUser);

    //Act
    const result = await useCase.obtenerPerfil('user-123');

    //Assert
    expect(result.id).toBe('user-123');
    expect(result.empleado?.nombre_completo).toBe('Juan Perez');
    expect(result.empleado?.cargo).toBe('Gerente');
    expect(mockPrisma.usuarios.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      select: expect.any(Object),
    });
  });

  it('Debería lanzar NotFoundException si el usuario no existe en la BD', async () => {
    //Arrange: Simular que la BD no encuentra al usuario
    mockPrisma.usuarios.findUnique.mockResolvedValue(null);

    //Act & Assert
    await expect(useCase.obtenerPerfil('user-404')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Debería manejar de forma segura un usuario huérfano (sin empleado asignado)', async () => {
    //Arrange: Simular un usuario que no tiene empleado asignado
    const mockDbUser = {
      id: 'user-123',
      email: 'admin@jyp.com',
      rol: 'ADMIN',
      empleados: null,
    };
    mockPrisma.usuarios.findUnique.mockResolvedValue(mockDbUser);

    //Act
    const result = await useCase.obtenerPerfil('user-123');

    //Assert
    expect(result.id).toBe('user-123');
    expect(result.empleado).toBeNull();
  });

  it('Debería lanzar InternalServerErrorException si la BD falla', async () => {
    //Arrange: Simular un error en la BD
    mockPrisma.usuarios.findUnique.mockRejectedValue(new Error('DB Timeout'));

    //Act & Assert
    await expect(useCase.obtenerPerfil('user-123')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
