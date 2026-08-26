//test/app.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';

/**
 * Pruebas unitarias para el controlador y servicio principal del sistema.
 * El objetivo es verificar que el endpoint de estado del sistema (Health Check) funcione correctamente y devuelva la metadata esperada.
 * Se comprueba que la información de estado, sistema, versión, entorno y créditos del proyecto se devuelva correctamente.
 */
describe('AppController & AppService - Status & Health Check', () => {
    let appController: AppController;
    let appService: AppService;

    //Configuración inicial antes de cada prueba
    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [AppService],
        }).compile();

        appController = app.get<AppController>(AppController);
        appService = app.get<AppService>(AppService);
    });

    //Prueba unitaria para verificar que el endpoint de estado del sistema devuelva la metadata completa y correcta
    describe('getHealth()', () => {
        it('Debe retornar la metadata completa del estado del sistema y créditos', () => {
            //Act
            const result = appController.getHealth();

            //Assert
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('system');
            expect(result.status).toBe('online');
            expect(result.system).toContain('Bella Planillas API');
            expect(result.credits.organization).toBe('J&P Perifericos S.A.C');
            expect(result.credits.project).toBe('Bella Planillas Enterprise System');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('environment');
        });

        it('AppService.getHealth() debe usar el entorno de proceso por defecto si NODE_ENV no está definido', () => {
            //Arrange: Guardar el valor original de NODE_ENV y eliminarlo temporalmente
            const originalEnv = process.env.NODE_ENV;
            delete process.env.NODE_ENV;

            //Act
            const health = appService.getHealth();

            //Assert
            expect(health.environment).toBe('development');
            process.env.NODE_ENV = originalEnv;
        });
    });
});