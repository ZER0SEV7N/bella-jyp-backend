//test/modules/RRHH/contrato/subirContrato.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SubirContratoPdfUseCase } from '@/modules/RRHH/contrato/use-cases/subirContratoPdf.useCase';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';

/**
 * Pruebas unitarias para el caso de uso SubirContratoPdfUseCase
 * Contiene pruebas exhaustivas para verificar el comportamiento del caso de uso de subida de contratos en formato PDF en el módulo de RRHH.
 * Se encarga de probar la lógica de negocio para subir un contrato PDF a la base de datos utilizando Prisma y la utilidad FileStorageUtil.
 * Incluye pruebas para verificar la existencia del contrato, la validez de la subida según las reglas de negocio, la correcta vinculación del archivo y el manejo de errores.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
describe('SubirContratoPdfUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: SubirContratoPdfUseCase;
    let prismaService: PrismaService;

    //Mock del contrato y archivo PDF para las pruebas unitarias
    const mockContratoId = '018f4a3c-7b2a-7123-8901-0123456789ad';
    const mockFileData = {
        filename: 'contrato_firmado.pdf',
        mimetype: 'application/pdf',
        file: {}
    };

    //Mock del servicio Prisma para simular la interacción con la base de datos
    const mockPrismaService = {
        contratos: {findUnique: jest.fn(), update: jest.fn() },
    };

    //Configuración del módulo de pruebas antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubirContratoPdfUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<SubirContratoPdfUseCase>(SubirContratoPdfUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    //Limpiar los mocks después de cada prueba
    afterEach(() => jest.clearAllMocks());

    describe('execute()', () => {
        it('Debe almacenar el archivo mediante FileStorageUtil y vincular la URL en el registro', async () => {
            //Arrange: Configuración del mock para simular un contrato existente y sin PDF previo
            const mockRutaGuardada = '/archivos/contratos/1771100000000-018f4a3c.pdf';
            jest.spyOn(FileStorageUtil, 'guardarArchivoMultipart').mockResolvedValue(mockRutaGuardada);

            //Configuración del mock para simular la existencia del contrato y la actualización exitosa del registro con la URL del PDF
            mockPrismaService.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                url: null, // Sin PDF previo
                observacion: 'Contrato preliminar',
                deleted_at: null
            });

            //Configuración del mock para simular la actualización exitosa del registro con la URL del PDF
            mockPrismaService.contratos.update.mockResolvedValue({
                id: mockContratoId,
                url: mockRutaGuardada
            });

            //Act
            const result = await useCase.execute(mockContratoId, mockFileData);

            //Assert: Verificar que el archivo fue almacenado correctamente y que la URL fue vinculada en el registro del contrato
            expect(FileStorageUtil.guardarArchivoMultipart).toHaveBeenCalledWith(mockFileData, 'contratos');
            expect(prismaService.contratos.update).toHaveBeenCalledWith({
                where: { id: mockContratoId },
                data: expect.objectContaining({url: mockRutaGuardada})
            });
            expect(result.url).toBe(mockRutaGuardada);
            expect(result.message).toContain('Documento subido y vinculado correctamente');
        });

        it('Debe rechazar la subida con BadRequestException si el contrato ya posee una URL asignada', async () => {
            //Arrange: Configuración del mock para simular un contrato existente y con PDF previo
            mockPrismaService.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                url: '/archivos/contratos/preexistente.pdf',
                deleted_at: null
            });

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(mockContratoId, mockFileData)).rejects.toThrow(new BadRequestException('El contrato ya tiene un PDF asociado. No se puede subir otro.'));
        });

        it('Debe lanzar NotFoundException si el contrato no existe en la BD', async () => {
            //Arrange: Configuración del mock para simular que el contrato no existe
            mockPrismaService.contratos.findUnique.mockResolvedValue(null);

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(mockContratoId, mockFileData)).rejects.toThrow(new NotFoundException('Contrato no encontrado o ha sido anulado.'));
        });

        it('Debe propagar excepciones de BadRequestException lanzadas por la utilidad de almacenamiento', async () => {
            //Arrange: Configuración del mock para simular un contrato existente y sin PDF previo
            mockPrismaService.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                url: null,
                deleted_at: null
            });

            //Simular que FileStorageUtil lanza una BadRequestException al intentar guardar un archivo no permitido
            jest.spyOn(FileStorageUtil, 'guardarArchivoMultipart').mockRejectedValue(new BadRequestException('Tipo de archivo no permitido. Solo se permiten archivos PDF y Word.'));
            //Act & Assert: Ejecutar el caso de uso y verificar que se propague la excepción esperada
            await expect(useCase.execute(mockContratoId, mockFileData)).rejects.toThrow(BadRequestException);
        });
    });
});