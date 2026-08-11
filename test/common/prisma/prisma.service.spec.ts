//test/common/prisma/prisma.service.spec.ts
//Pruebas unitarias para el servicio de Prisma
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';

//Mock del middleware de auditoría para simular su comportamiento durante las pruebas
let mockAuditMiddleware: any;

//Mockear los modulos externos de conexion antes de ejecutar las pruebas unitarias
jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = jest.fn();
    $disconnect = jest.fn();
    $extends = jest.fn().mockImplementation(function (this: any, config) {
      if (config?.query?.$allModels?.$allOperations)
        mockAuditMiddleware = config.query.$allModels.$allOperations;

      // Retornamos un objeto falso que simula tener las tablas para que el middleware no explote
      return Object.assign(this, {
        audit_log: { create: jest.fn() },
        dummy_table: { findUnique: jest.fn() },
      });
    });
  }
  return { PrismaClient: MockPrismaClient };
});

//Mockear 'pg' y '@prisma/adapter-pg' simplemente para que no hagan nada al importarlos
jest.mock('pg', () => ({ Pool: jest.fn() }));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

//Describir el bloque de pruebas unitarias para el servicio de Prisma
describe('PrismaService', () => {
  let service: any;
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
        { provide: ClsService, useValue: mockClsService }, //Utiliza el Mock del ClsService en lugar del real
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

  //==============================================================================
  //PRUEBAS DE CICLO DE VIDA (Arranque y Apagado)
  //==============================================================================
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

  //==============================================================================
  //PRUEBAS DEL MIDDLEWARE DE AUDITORÍA ($extends)
  //==============================================================================
  describe('Middleware de Auditoría (Audit Log)', () => {
    it('Debería ignorar las operaciones de lectura (findMany, findUnique)', async () => {
      const mockQuery = jest.fn().mockResolvedValue([{ id: 1 }]);

      const result = await mockAuditMiddleware({
        model: 'empleados',
        operation: 'findMany',
        args: {},
        query: mockQuery,
      });

      expect(result).toEqual([{ id: 1 }]);
      expect(mockQuery).toHaveBeenCalled();
      expect(service.audit_log.create).not.toHaveBeenCalled();
    });

    it('Debería ignorar cambios en las propias tablas de auditoría o tokens', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ id: 1 });

      await mockAuditMiddleware({
        model: 'audit_log',
        operation: 'create',
        args: {},
        query: mockQuery,
      });

      expect(service.audit_log.create).not.toHaveBeenCalled();
    });

    it('Debería registrar un INSERT (create) correctamente obteniendo el usuario del CLS', async () => {
      const mockQuery = jest
        .fn()
        .mockResolvedValue({ id: 'nuevo-registro', nombre: 'Test' });
      mockClsService.get.mockImplementation((key) => {
        if (key === 'CLS_USER_ID') return 'user-123';
        if (key === 'CLS_IP_ADDRESS') return '192.168.1.100';
      });

      await mockAuditMiddleware({
        model: 'area',
        operation: 'create',
        args: { data: { nombre: 'Test' } },
        query: mockQuery,
      });

      expect(service.audit_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuario_id: 'user-123',
            accion: 'CREATE',
            tabla_afectada: 'area',
            direccion_ip: '192.168.1.100',
            registro_id: 'nuevo-registro',
            valores_antes: null,
            valores_despues: expect.objectContaining({
              id: 'nuevo-registro',
              nombre: 'Test',
            }),
          }),
        }),
      );
    });

    it('Debería intentar capturar el estado previo antes de un UPDATE', async () => {
      const mockQuery = jest
        .fn()
        .mockResolvedValue({ id: 'reg-1', nombre: 'Nuevo Nombre' });

      // Simulamos que Prisma encuentra el estado previo
      service.dummy_table.findUnique.mockResolvedValue({
        id: 'reg-1',
        nombre: 'Viejo Nombre',
      });

      await mockAuditMiddleware({
        model: 'dummy_table',
        operation: 'update',
        args: { where: { id: 'reg-1' }, data: { nombre: 'Nuevo Nombre' } },
        query: mockQuery,
      });

      expect(service.dummy_table.findUnique).toHaveBeenCalled();

      // Verificamos que se guardó el "Antes" y el "Después"
      expect(service.audit_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accion: 'UPDATE',
            valores_antes: expect.objectContaining({
              id: 'reg-1',
              nombre: 'Viejo Nombre',
            }),
            valores_despues: expect.objectContaining({
              id: 'reg-1',
              nombre: 'Nuevo Nombre',
            }),
          }),
        }),
      );
    });

    it('No debe interrumpir la operación si la auditoría falla', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ id: 'exito' });
      // Simulamos que la tabla de auditoría se cayó y da error
      service.audit_log.create.mockRejectedValue(
        new Error('Fallo al guardar log'),
      );

      // Act: Ejecutamos el middleware
      const result = await mockAuditMiddleware({
        model: 'area',
        operation: 'create',
        args: {},
        query: mockQuery,
      });

      // Assert: La operación principal (el query real) debió retornar con éxito a pesar del fallo del log
      expect(result).toEqual({ id: 'exito' });
    });
  });
});
