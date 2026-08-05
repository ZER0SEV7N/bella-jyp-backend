//test/modules/RRHH/Area/EliminarArea.UseCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EliminarAreaUseCase } from '@/modules/RRHH/use-cases/area/eliminarArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';

describe('EliminarAreaUseCase', () => {
    let useCase: EliminarAreaUseCase;
    let mockPrisma: any;
    //Configurar el módulo de prueba antes de cada prueba
    beforeEach(async () => {
        mockPrisma = {
            area: { findUnique: jest.fn(), update: jest.fn() },
            cargo: { count: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EliminarAreaUseCase,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        useCase = module.get<EliminarAreaUseCase>(EliminarAreaUseCase);
    })

    //Limpiar los mocks después de cada prueba para evitar interferencias entre pruebas
    afterEach(() => jest.clearAllMocks());

    it('Deberia eliminar un área correctamente (Soft Delete)', async () => {
        //Arrange: Configurar el mock para simular la existencia del área y su eliminación
        mockPrisma.area.findUnique = jest.fn().mockResolvedValue({ id: 'area-1', deleted_at: null });
        mockPrisma.cargo.count.mockResolvedValue(0);
        mockPrisma.area.update = jest.fn().mockResolvedValue({ id: 'area-1', nombre: 'Área de Prueba', activo: false });

        //Act: Ejecutar el caso de uso
        const result = await useCase.execute('area-1');

        //Assert: Verificar que el resultado sea el esperado
        expect(result).toEqual({
            id: 'area-1',
            nombre: 'Área de Prueba',
            activo: false,
        });
        expect(result.activo).toBe(false);
        expect(mockPrisma.area.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activo: false }) }));
    });

    it('Debería lanzar NotFoundException si el área no existe o ya fue eliminada', async () => {
        //Arrange: Configurar el mock para simular que el área no existe
        mockPrisma.area.findUnique.mockResolvedValue(null);
        //Act & Assert: Ejecutar el caso de uso y verificar que lance NotFoundException
        await expect(useCase.execute('area-404')).rejects.toThrow(NotFoundException);

        //Arrange: Configurar el mock para simular que el área ya fue eliminada
        mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-123', deleted_at: new Date() });
        //Act & Assert: Ejecutar el caso de uso y verificar que lance NotFoundException
        await expect(useCase.execute('area-123')).rejects.toThrow(NotFoundException);
    });

    it('Debería lanzar BadRequestException si el área tiene cargos activos', async () => {
        //Arrange: Configurar el mock para simular que el área tiene cargos activos
        mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-123', deleted_at: null });
        mockPrisma.cargo.count.mockResolvedValue(5); 

        //Act & Assert: Ejecutar el caso de uso y verificar que lance BadRequestException
        await expect(useCase.execute('area-123')).rejects.toThrow(BadRequestException);
        expect(mockPrisma.area.update).not.toHaveBeenCalled(); 
    });

    it('Debería lanzar InternalServerErrorException si la base de datos falla en el proceso', async () => {
        //Arrange: Configurar el mock para simular un fallo en la base de datos 
        mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-123', deleted_at: null });
        mockPrisma.cargo.count.mockResolvedValue(0);
        mockPrisma.area.update.mockRejectedValue(new Error('DB Down'));

        //Act & Assert: Ejecutar el caso de uso y verificar que lance InternalServerErrorException
        await expect(useCase.execute('area-123')).rejects.toThrow(InternalServerErrorException);
    });
});