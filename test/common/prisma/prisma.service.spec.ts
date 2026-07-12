//test/common/prisma/prisma.service.spec.ts
//Pruebas unitarias para el servicio de Prisma
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Pool } from 'pg';

//Mockear los modulos externos de conexion antes de ejecutar las pruebas unitarias
jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
    })),
}));

describe('PrismaService', () => {
    let service: PrismaService;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
        //Salvaguardar el estado original de las variables de entorno
        originalEnv = process.env;
        process.env = { ...originalEnv, DATABASE_URL: 'postgresql://user:password@localhost:5432/testdb', NODE_ENV: 'test' };
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
        //Arrange: Creamos una instancia del servicio
        const module: TestingModule = await Test.createTestingModule({
            providers: [PrismaService],
        }).compile();

        service = module.get<PrismaService>(PrismaService);

        //Mockear el método $connect para simular la conexión exitosa a la base de datos
        service.$connect = jest.fn().mockResolvedValue(undefined);

        //Act: Llamamos al método onModuleInit
        await service.onModuleInit();

        //Assert: Validamos que el Pool fue instanciado y que $connect fue llamado
        expect(Pool).toHaveBeenCalledWith({ connectionString: 'postgresql://user:password@localhost:5432/testdb' });
        expect(service.$connect).toHaveBeenCalledTimes(1);
    });

    it('Deberia lanzar un error si falla la conexion inicial onModuleInit', async () => {
        //Arrange
        service = new PrismaService();
        const mockError = new Error('Database connection failed');
        service.$connect = jest.fn().mockRejectedValue(mockError);

        //Act & Assert: Esperamos que onModuleInit lance un error crítico
        await expect(service.onModuleInit()).rejects.toThrow(mockError);
    });

    it('Deberia desconectarse limpiamente en onModuleDestroy', async () => {
        //Arrange
        service = new PrismaService();
        service.$disconnect = jest.fn().mockResolvedValue(undefined);

        //Act
        await service.onModuleDestroy();

        //Assert: Validamos que $disconnect fue llamado
        expect(service.$disconnect).toHaveBeenCalledTimes(1);
    });
});