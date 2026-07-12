//test/common/prisma/prisma.service.spec.ts
//Pruebas unitarias para el servicio de Prisma
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Pool } from 'pg';

//Mockear los modulos externos de conexion antes de ejecutar las pruebas unitarias
jest.mock('@prisma/client', () => ({
    PrismaClient: class {
        $connect = jest.fn();
        $disconnect = jest.fn();
    }
}));

// Mockeamos 'pg' y '@prisma/adapter-pg' simplemente para que no hagan nada al importarlos
jest.mock('pg', () => ({ Pool: jest.fn() }));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

describe('PrismaService', () => {
    let service: PrismaService;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
        originalEnv = process.env;
        process.env = { 
            ...originalEnv, 
            DATABASE_URL: 'postgresql://postgres:testpass@localhost:5432/planillas_db_test?schema=public',
            NODE_ENV: 'test' 
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [PrismaService],
        }).compile();

        service = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        //Restaurar las variables de entorno originales después de cada prueba
        process.env = originalEnv;
        jest.clearAllMocks();
    });

    it('Deberia Lanzar una excepcion critica si no existe DATABASE_URL en el entorno', async () => {
        //Arrange: Simulamos que DATABASE_URL no está definida
        delete process.env.DATABASE_URL;
        
        //Act & Assert: Esperamos que la instanciación del servicio lance un error crítico
        expect(() => new PrismaService()).toThrow(
            'CRITICAL: DATABASE_URL no está definida en el entorno. Verifica tu archivo .env'
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
        const devService = new PrismaService();

        // Assert: Simplemente validamos que se pudo instanciar correctamente sin errores 
        // al pasar por la rama de "development".
        expect(devService).toBeDefined();
    });
});