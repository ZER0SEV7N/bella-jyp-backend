//test/common/guards/roles.guard.spec.ts
//Pruebas unitarias para el guard de roles
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
    let guard: RolesGuard; //Instancia del guard que se va a probar
    let mockReflector: any; //Mock del reflector para obtener los roles requeridos

    beforeEach(async () => {
        // Creamos un objeto falso con la función que necesitamos mockear
        mockReflector = {
            getAllAndOverride: jest.fn(),
        };
        
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RolesGuard,
                // Le decimos a NestJS: "Cuando el Guard pida un Reflector, dale nuestro mock"
                { provide: Reflector, useValue: mockReflector },
            ],
        }).compile();

        // Obtenemos la instancia generada por NestJS
        guard = module.get<RolesGuard>(RolesGuard);
    });

    //Limpiar los mocks después de cada prueba para evitar efectos secundarios
    afterEach(() => {
        jest.clearAllMocks();
    });

    //Funcion para crear un contexto de ejecución simulado con roles de usuario
    const createMockContext = (userRole?: string): ExecutionContext => {
        return {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({
                    user: userRole ? { rol: userRole } : undefined, //Simula el rol del usuario en la solicitud
                }),
            }),
        } as unknown as ExecutionContext;
    };

    it('Deberia permitir el acceso si el endpoint no tiene el decorador @Roles (público)', () => {
        //Arrange
        mockReflector.getAllAndOverride.mockReturnValue(undefined);
        const context = createMockContext();

        expect(guard.canActivate(context)).toBe(true); //Assert: Se espera que el guard permita el acceso
    });

    it('Deberia permitir el acceso si el usuario tiene un rol permitido', () => {
        //Arrange
        const requiredRoles = ['ADMIN', 'RRHH'];
        mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);
        const context = createMockContext('ADMIN'); //Simulamos que el usuario tiene el rol ADMIN

        //Act & Assert
        expect(guard.canActivate(context)).toBe(true); //Assert: Se espera que el guard permita el acceso
    });

    it('Deberia lanzar ForbiddenException si no hay usuario en la solicitud', () => {
        //Arrange
        const requiredRoles = ['ADMIN'];
        mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);
        const context = createMockContext(undefined); //Simulamos que no hay usuario en la solicitud

        //Act & Assert
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('Deberia lanzar ForbiddenException si el usuario no tiene un rol permitido', () => {
        //Arrange
        const requiredRoles = ['ADMIN'];
        mockReflector.getAllAndOverride.mockReturnValue(requiredRoles);
        const context = createMockContext('USER'); //Simulamos que el usuario tiene el rol USER

        //Act & Assert
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException); 
        try{
            guard.canActivate(context);
        }catch (error: any) {
            expect(error.response).toMatchObject({
                status: 403,
                title: 'Acceso Denegado',
            });
        }
    });
});