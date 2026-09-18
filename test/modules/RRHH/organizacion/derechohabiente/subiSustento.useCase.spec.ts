//test/modules/RRHH/organizacion/derechohabiente/subiSustento.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SubirSustentoDerechohabienteUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/subirSustento.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { SubirSustentoDerechohabienteDto } from '@jyp/shared-contracts';

jest.mock('@/common/utils/fileStorage.util', () => ({
  FileStorageUtil: { guardarArchivoMultipart: jest.fn() }
}));

describe('SubirSustentoDerechohabienteUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: SubirSustentoDerechohabienteUseCase;
  let prisma: PrismaService;

  const mockPrisma = {
    derechohabientes: { findUnique: jest.fn() },
    derechohabiente_documentos: { create: jest.fn() }
  };

  const payloadDto: SubirSustentoDerechohabienteDto = {
    derechohabiente_id: '018f4a7c-dh-0000-0000-000000000001',
    tipo_documento: 'PARTIDA_NACIMIENTO',
    fecha_emision: '2020-06-01'
  };

  const fileDataMock = {
    filename: 'partida_nacimiento_original.pdf',
    mimetype: 'application/pdf',
    file: {}
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubirSustentoDerechohabienteUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<SubirSustentoDerechohabienteUseCase>(SubirSustentoDerechohabienteUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('sustento-uuid-100');
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe procesar el archivo mediante streaming y crear el registro en derechohabiente_documentos', async () => {
      // Arrange
      mockPrisma.derechohabientes.findUnique.mockResolvedValue({
        id: payloadDto.derechohabiente_id,
        activo: true,
        deleted_at: null,
      });

      (FileStorageUtil.guardarArchivoMultipart as jest.Mock).mockResolvedValue('/archivos/derechohabientes/178520-doc.pdf');

      mockPrisma.derechohabiente_documentos.create.mockResolvedValue({
        id: 'sustento-uuid-100',
        derechohabiente_id: payloadDto.derechohabiente_id,
        tipo_documento: 'PARTIDA_NACIMIENTO',
        nombre_archivo: 'partida_nacimiento_original.pdf',
        archivo_url: '/archivos/derechohabientes/178520-doc.pdf',
        vigente: true
      });

      // Act
      const result = await useCase.execute(payloadDto, fileDataMock);

      // Assert
      expect(FileStorageUtil.guardarArchivoMultipart).toHaveBeenCalledWith(
        fileDataMock,
        'derechohabientes'
      );
      expect(mockPrisma.derechohabiente_documentos.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'sustento-uuid-100',
          derechohabiente_id: payloadDto.derechohabiente_id,
          tipo_documento: 'PARTIDA_NACIMIENTO',
          nombre_archivo: 'partida_nacimiento_original.pdf',
          archivo_url: '/archivos/derechohabientes/178520-doc.pdf',
          vigente: true
        }),
      });
      expect(result.id).toBe('sustento-uuid-100');
      expect(result.vigente).toBe(true);
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar NotFoundException si el derechohabiente no existe o está eliminado', async () => {
      // Arrange
      mockPrisma.derechohabientes.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(payloadDto, fileDataMock)).rejects.toThrow(NotFoundException);
      expect(FileStorageUtil.guardarArchivoMultipart).not.toHaveBeenCalled();
      expect(mockPrisma.derechohabiente_documentos.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si el tipo de archivo o streaming falla en FileStorageUtil', async () => {
      // Arrange
      mockPrisma.derechohabientes.findUnique.mockResolvedValue({
        id: payloadDto.derechohabiente_id,
        deleted_at: null
      });

      (FileStorageUtil.guardarArchivoMultipart as jest.Mock).mockRejectedValue(new BadRequestException('Tipo de archivo no permitido. Solo se permiten archivos PDF y Word.'));

      // Act & Assert
      await expect(useCase.execute(payloadDto, fileDataMock)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.derechohabiente_documentos.create).not.toHaveBeenCalled();
    });

    it('Debe envolver errores de BD en InternalServerErrorException', async () => {
      // Arrange
      mockPrisma.derechohabientes.findUnique.mockResolvedValue({
        id: payloadDto.derechohabiente_id,
        deleted_at: null
      });
      (FileStorageUtil.guardarArchivoMultipart as jest.Mock).mockResolvedValue('/archivo.pdf');
      mockPrisma.derechohabiente_documentos.create.mockRejectedValue(new Error('Conexión perdida a PostgreSQL'));

      // Act & Assert
      await expect(useCase.execute(payloadDto, fileDataMock)).rejects.toThrow(InternalServerErrorException);
    });
  });
});