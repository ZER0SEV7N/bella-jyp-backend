//test/modules/RRHH/contrato/anularContrato.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AnularContratoUseCase } from '@/modules/RRHH/contrato/use-cases/anularContrato.useCase';

/**
 * Test para el caso de uso AnularContratoUseCase
 * Contiene pruebas unitarias para verificar el comportamiento del caso de uso de anulación de contratos en el módulo de RRHH.
 * Se encarga de probar la lógica de negocio para anular un contrato en la base de datos utilizando Prisma.
 * Incluye pruebas para verificar la existencia del contrato, la correcta anulación y el manejo de errores.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
describe('AnularContratoUseCase', () => {
    let useCase: AnularContratoUseCase;
    let prismaService: PrismaService;

    const mockContratoId = '018f4a3c-7b2a-7123-8901-0123456789ad'; //Id de contrato de prueba para las pruebas unitarias

    const mockPrisma = {
        contratos: {
            findUnique: jest.fn(),
            update: jest.fn()
        }
    };

    //Configuración del módulo de pruebas antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AnularContratoUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<AnularContratoUseCase>(AnularContratoUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

    describe('execute', () => {
        it('Debe anular un contrato exitosamente estableciendo la fecha de borrado logico', async () => {
            //Arrange 
            const mockContrato = {
                id: mockContratoId,
                empleado_id: '018f4a3c-7b2a-7123-8901-0123456789ab',
                deleted_at: null
            };

            const fechaBaja = new Date().toISOString();

            mockPrisma.contratos.findUnique.mockResolvedValue(mockContrato);
            mockPrisma.contratos.update.mockResolvedValue({
                ...mockContrato,
                deleted_at: fechaBaja
            });

            //Act
            const result = await useCase.execute(mockContratoId);

            //Assert
            expect(prismaService.contratos.findUnique).toHaveBeenCalledWith({ where: { id: mockContratoId } });
            expect(prismaService.contratos.update).toHaveBeenCalledWith({
                where: { id: mockContratoId },
                data: { deleted_at: expect.any(Date) },
            });
            expect(result.deleted_at).toEqual(fechaBaja);
        });

        it('Debe lanzar NotFoundException si el contrato no existe en la BD', async () => {
            //Arrange: Prisma devuelve null porque no encontró el contrato
            mockPrisma.contratos.findUnique.mockResolvedValue(null);

            //Act & Assert
            await expect(useCase.execute(mockContratoId)).rejects.toThrow(new NotFoundException('Contrato no encontrado o ya eliminado.'));
        });

        it('Debe rechazar con NotFoundException si el contrato ya se encontraba deshabilitado (deleted_at !== null)', async () => {
            //Arrange: Prisma devuelve un contrato con deleted_at distinto de null
            mockPrisma.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                deleted_at: new Date('2026-01-01'),
            });

            //Act & Assert
            await expect(useCase.execute(mockContratoId)).rejects.toThrow(new NotFoundException('Contrato no encontrado o ya eliminado.'));
            expect(prismaService.contratos.update).not.toHaveBeenCalled();
            });

        it('Debe capturar errores imprevistos del motor de base de datos y lanzar InternalServerErrorException', async () => {
            //Arrange: Prisma lanza un error inesperado al intentar actualizar el contrato
            mockPrisma.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                deleted_at: null
            });

            //Simular un error de la base de datos al intentar actualizar el contrato
            mockPrisma.contratos.update.mockRejectedValue(new Error('PostgreSQL Lock Timeout'));

            //Act & Assert
            await expect(useCase.execute(mockContratoId)).rejects.toThrow(new InternalServerErrorException('Error al intentar eliminar el contrato.'));
        });
    });
});