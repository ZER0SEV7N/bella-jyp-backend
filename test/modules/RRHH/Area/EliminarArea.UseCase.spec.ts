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
        mockPrisma.area.findUnique.mockResolvedValue(null);
        await expect(useCase.execute('area-404')).rejects.toThrow(NotFoundException);

        mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-123', deleted_at: new Date() });
        await expect(useCase.execute('area-123')).rejects.toThrow(NotFoundException);
    });

    it('Debería lanzar BadRequestException si el área tiene cargos activos', async () => {
        mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-123', deleted_at: null });
        // Simulamos que el área tiene 5 cargos asociados
        mockPrisma.cargo.count.mockResolvedValue(5); 

        await expect(useCase.execute('area-123')).rejects.toThrow(BadRequestException);
        expect(mockPrisma.area.update).not.toHaveBeenCalled(); // Aseguramos que NO se borró
    });

    it('Debería lanzar InternalServerErrorException si la base de datos falla en el proceso', async () => {
        mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-123', deleted_at: null });
        mockPrisma.cargo.count.mockResolvedValue(0);
        // Falla el update por caída de BD
        mockPrisma.area.update.mockRejectedValue(new Error('DB Down'));

        await expect(useCase.execute('area-123')).rejects.toThrow(InternalServerErrorException);
    });
});