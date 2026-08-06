//test/modules/RRHH/empleados/reactivarEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ActiveEmpleadoUseCase } from '@/modules/RRHH/use-cases/empleado/activeEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso ActiveEmpleadoUseCase.
 * Se verifica que el caso de uso maneje correctamente la reactivación de empleados,
 * incluyendo validaciones de existencia y manejo de errores.
 * Se utilizan mocks para simular la interacción con PrismaService y evitar llamadas reales a la base de datos.
 */
describe('ActiveEmpleadoUseCase', () => {
    let useCase: ActiveEmpleadoUseCase;
    let mockPrisma: any;

    //Configuración inicial antes de cada prueba
    beforeEach(async () => {
        mockPrisma = {empleados: { update: jest.fn() }};

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ActiveEmpleadoUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<ActiveEmpleadoUseCase>(ActiveEmpleadoUseCase);
    });

    afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba para evitar interferencias entre pruebas

    it('Debería reactivar el empleado y limpiar la fecha de cese y deleted_at', async () => {
        //Arrange: Simulamos que la actualización es exitosa
        const validUUID = '123e4567-e89b-12d3-a456-426614174000';
        mockPrisma.empleados.update.mockResolvedValue({ id: validUUID, activo: true });

        //Act: Ejecutamos el caso de uso para reactivar el empleado
        const result = await useCase.execute(validUUID);

        //Assert: Verificamos que el empleado fue reactivado correctamente y que se limpiaron las fechas
        expect(result.state).toBe(true);
        expect(mockPrisma.empleados.update).toHaveBeenCalledWith({
            where: { id: validUUID },
            data: expect.objectContaining({
                activo: true,
                fecha_cese: null,
                deleted_at: null
            })
        });
    });

    it('Debería lanzar BadRequestException si el Zod falla por un ID inválido', async () => {
        //Arrange: Simulamos un ID inválido
        const invalidUUID = 'no-es-uuid';
        
        //Act & Assert: Ejecutamos el caso de uso y verificamos que se lance la excepción esperada
        await expect(useCase.execute(invalidUUID)).rejects.toThrow(BadRequestException);
        expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
    });
});