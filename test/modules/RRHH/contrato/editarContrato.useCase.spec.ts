//test/modules/RRHH/contrato/editarContrato.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EditarContratoUseCase } from '@/modules/RRHH/contrato/use-cases/editarContrato.useCase';
import { EditarContratoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso EditarContratoUseCase
 * Contiene pruebas exhaustivas para verificar el comportamiento del caso de uso de edición de contratos en el módulo de RRHH.
 * Se encarga de probar la lógica de negocio para editar un contrato en la base de datos utilizando Prisma.
 * Incluye pruebas para verificar la existencia del contrato, la validez de la edición según las reglas de negocio, la correcta actualización y el manejo de errores.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
describe('EditarContratoUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: EditarContratoUseCase;
    let prismaService: PrismaService;

    const mockContratoId = '018f4a3c-7b2a-7123-8901-0123456789ad';

    //DTO de prueba para editar un contrato
    const dtoEditar: EditarContratoDto = {
        tipo_modalidad: 'INCREMENTO_ACTIVIDAD',
        observacion: 'Cambio de modalidad laboral'
    };

    //Mock del servicio Prisma para simular la interacción con la base de datos
    const mockPrismaService = {
        contratos: {
            findUnique: jest.fn(),
            update: jest.fn()
        }
    };

    //Configuración del módulo de pruebas antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EditarContratoUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<EditarContratoUseCase>(EditarContratoUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    //Pruebas unitarias para el método execute del caso de uso EditarContratoUseCase
    describe('execute()', () => {
        it('Debe permitir la edición cuando el contrato no está sellado (url === null)', async () => {
            //Arrange: Configuración del mock para simular un contrato existente y no sellado
            const mockContrato = {
                id: mockContratoId,
                url: null,
                deleted_at: null
            };

            //Configuración de los mocks para simular la existencia del contrato y la actualización exitosa
            mockPrismaService.contratos.findUnique.mockResolvedValue(mockContrato);
            mockPrismaService.contratos.update.mockResolvedValue({
                ...mockContrato,
                ...dtoEditar
            });

            //Act: Ejecutar el caso de uso con los datos de edición
            const result = await useCase.execute(mockContratoId, dtoEditar);

            //Assert: Verificar que el contrato fue editado correctamente
            expect(prismaService.contratos.update).toHaveBeenCalledWith({
                where: { id: mockContratoId },
                data: expect.objectContaining({tipo_modalidad: 'INCREMENTO_ACTIVIDAD'})
            });
            expect(result.tipo_modalidad).toBe('INCREMENTO_ACTIVIDAD');
        });

        it('Regla de Negocio / Inmutabilidad: Debe rechazar con BadRequestException si el contrato ya posee PDF (url !== null)', async () => {
            //Arrange: Configuración del mock para simular un contrato existente y sellado (con URL)
            mockPrismaService.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                url: '/archivos/contratos/12345.pdf', 
                deleted_at: null
            });

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(mockContratoId, dtoEditar)).rejects.toThrow(new BadRequestException('El contrato ha sido sellado. No se puede editar porque ya cuenta con un documento físico adjunto.'));
            expect(prismaService.contratos.update).not.toHaveBeenCalled();
        });

        it('Excepción: Debe lanzar NotFoundException si el contrato no existe o fue deshabilitado', async () => {
            //Arrange: Configuración del mock para simular un contrato no existente
            mockPrismaService.contratos.findUnique.mockResolvedValue(null);

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(mockContratoId, dtoEditar)).rejects.toThrow(new NotFoundException('El contrato especificado no existe o ha sido eliminado.'));
        });

        it('Resiliencia: Debe retornar InternalServerErrorException ante fallos al guardar en base de datos', async () => {
            //Arrange: Configuración del mock para simular un contrato existente
            mockPrismaService.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                url: null,
                deleted_at: null
            });
            mockPrismaService.contratos.update.mockRejectedValue(new Error('PostgreSQL Driver Error'));

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(mockContratoId, dtoEditar)).rejects.toThrow(new InternalServerErrorException('Error al actualizar los datos del contrato.'));
        });
    });
});