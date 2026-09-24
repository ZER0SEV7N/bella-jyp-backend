import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { RegistroAuditoriaUseCase } from '@/modules/core/audit/use-cases/registroAuditoria.useCase';
import { AuditLogDto } from '@jyp/shared-contracts';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '@/common/cls/cls.constants';

describe('RegistroAuditoriaUseCase - Pruebas Unitarias de Registro Manual', () => {
  let useCase: RegistroAuditoriaUseCase;
  let prismaService: PrismaService;
  let clsService: ClsService;

  const mockPrismaService = {
    audit_log: {
      create: jest.fn(),
    },
  };

  const mockClsService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistroAuditoriaUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ClsService, useValue: mockClsService },
      ],
    }).compile();

    useCase = module.get<RegistroAuditoriaUseCase>(RegistroAuditoriaUseCase);
    prismaService = module.get<PrismaService>(PrismaService);
    clsService = module.get<ClsService>(ClsService);

    jest.clearAllMocks();
  });

  describe('execute() - Registro Manual de Auditoría', () => {
    it('Happy Path: Debe registrar un log de auditoría manual extrayendo userId e IP del contexto CLS', async () => {
      const payload: AuditLogDto = {
        accion: 'EXPORT_PLAME',
        tabla_afectada: 'historial_planillas',
        registro_id: '018f4a3c-7b2a-7123-8901-0123456789ab',
        valores_antes: { estado: 'ABIERTO' },
        valores_despues: { estado: 'EXPORTADO' },
      };

      mockClsService.get.mockImplementation((key) => {
        if (key === CLS_USER_ID) return 'user-uuid-100';
        if (key === CLS_IP_ADDRESS) return '192.168.1.50';
        return null;
      });

      const mockCreatedLog = {
        id: '018f4a3c-7b2a-7123-8901-999999999999',
        usuario_id: 'user-uuid-100',
        direccion_ip: '192.168.1.50',
        ...payload,
      };

      mockPrismaService.audit_log.create.mockResolvedValue(mockCreatedLog);

      const result = await useCase.execute(payload);

      expect(clsService.get).toHaveBeenCalledWith(CLS_USER_ID);
      expect(clsService.get).toHaveBeenCalledWith(CLS_IP_ADDRESS);
      expect(prismaService.audit_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: 'user-uuid-100',
          direccion_ip: '192.168.1.50',
          accion: 'EXPORT_PLAME',
          tabla_afectada: 'historial_planillas',
          registro_id: '018f4a3c-7b2a-7123-8901-0123456789ab',
          valores_antes: { estado: 'ABIERTO' },
          valores_despues: { estado: 'EXPORTADO' },
        }),
      });
      expect(result).toEqual(mockCreatedLog);
    });

    it('Edge Case: Debe usar IP por defecto (127.0.0.1) y userId null cuando el contexto CLS está vacío', async () => {
      const payload: AuditLogDto = {
        accion: 'SELECT_CRITICAL',
        tabla_afectada: 'empleados',
        registro_id: '018f4a3c-7b2a-7123-8901-0123456789ac',
      };

      mockClsService.get.mockReturnValue(undefined);
      mockPrismaService.audit_log.create.mockResolvedValue({ id: 'log-created' });

      await useCase.execute(payload);

      expect(prismaService.audit_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuario_id: null,
          direccion_ip: '127.0.0.1',
          valores_antes: null,
          valores_despues: null,
        }),
      });
    });

    it('Resiliencia: Debe lanzar InternalServerErrorException con respuesta RFC 7807 si la inserción en BD falla', async () => {
      const payload: AuditLogDto = {
        accion: 'REPORT_DOWNLOAD',
        tabla_afectada: 'dato_financiero',
        registro_id: '018f4a3c-7b2a-7123-8901-0123456789ad',
      };

      mockClsService.get.mockReturnValue(null);
      mockPrismaService.audit_log.create.mockRejectedValue(new Error('PostgreSQL deadlock'));

      await expect(useCase.execute(payload)).rejects.toThrow(
        new InternalServerErrorException({
          title: 'Fallo de Auditoría Manual',
          detail: 'No se pudo guardar el rastro del sistema.',
        }),
      );
    });
  });
});