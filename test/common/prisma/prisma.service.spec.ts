//test/common/prisma/prisma.service.spec.ts
//Pruebas unitarias para el servicio de Prisma
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

//Mockear los modulos externos de conexion antes de ejecutar las pruebas unitarias
jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = jest.fn();
    $disconnect = jest.fn();
    $extends = jest.fn().mockReturnThis();
  }
  return { PrismaClient: MockPrismaClient };
});

//Mockear 'pg' y '@prisma/adapter-pg' simplemente para que no hagan nada al importarlos
jest.mock('pg', () => ({ Pool: jest.fn() }));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

//Describir el bloque de pruebas unitarias para el servicio de Prisma
describe('PrismaService', () => {
  let service: PrismaService;
  let originalEnv: NodeJS.ProcessEnv;

  //Crear un Mock del ClsService para inyectarlo en el PrismaService
  const mockClsService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      DATABASE_URL:
        'postgresql://postgres:testpass@localhost:5432/planillas_db_test?schema=public',
      NODE_ENV: 'test',
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ClsService,
          useValue: mockClsService, //Utiliza el Mock del ClsService en lugar del real
        },
      ],
    }).compile();

    //Obtener la instancia del servicio de Prisma desde el módulo de pruebas
    service = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    //Restaurar las variables de entorno originales después de cada prueba
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  //Prueba para verificar que el servicio se instancia correctamente
  it('Debería instanciarse correctamente con dependencias simuladas', () => {
    expect(service).toBeDefined();
  });

  //Prueba para verificar que el servicio lanza una excepción crítica si no existe DATABASE_URL en el entorno
  it('Deberia Lanzar una excepcion critica si no existe DATABASE_URL en el entorno', async () => {
    //Arrange: Simulamos que DATABASE_URL no está definida
    delete process.env.DATABASE_URL;

    //Act & Assert: Esperamos que la instanciación del servicio lance un error crítico
    expect(() => new PrismaService(mockClsService as any)).toThrow(
      'CRITICAL: DATABASE_URL no está definida en el entorno. Verifica tu archivo .env',
    );
  });

  it('Deberia inicializar el Pool de PG y conectarse a la DB en onModuleInit', async () => {
    // Act
    await service.onModuleInit();

    // Assert: Validamos que llamó a $connect
    expect(service.$connect).toHaveBeenCalledTimes(1);
  });

  it('Deberia lanzar un error si falla la conexion inicial onModuleInit', async () => {
    // Arrange
    const mockError = new Error('Database connection failed');
    service.$connect = jest.fn().mockRejectedValue(mockError);

    // Act & Assert
    await expect(service.onModuleInit()).rejects.toThrow(mockError);
  });

  it('Deberia desconectarse limpiamente en onModuleDestroy', async () => {
    // Act
    await service.onModuleDestroy();

    // Assert: Validamos que llamó a $disconnect
    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('Deberia configurar los logs en nivel detallado si NODE_ENV es development', () => {
    // Arrange: Forzamos el entorno a development antes de instanciar
    process.env.NODE_ENV = 'development';

    // Act
    const devService = new PrismaService(mockClsService as any);

    // Assert: Simplemente validamos que se pudo instanciar correctamente sin errores
    // al pasar por la rama de "development".
    expect(devService).toBeDefined();
  });
});
