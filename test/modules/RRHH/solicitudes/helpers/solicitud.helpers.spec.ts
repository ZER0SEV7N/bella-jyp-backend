//test/modules/RRHH/solicitudes/solicitudes-helpers.spec.ts
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  esColisionDeCodigo,
  generarCodigoCorrelativo,
  resolverEmpleadoSolicitante,
  validarDatosSolicitud,
} from '@/modules/RRHH/solicitudes/helpers/creacionSolicitud.helper';
import {
  calcularAntiguedad,
  calcularFechaLimiteRevision,
  convertirFechaSolicitud,
  obtenerAlertaUrgencia,
} from '@/modules/RRHH/solicitudes/helpers/fechasSolicitud.helper';
import {
  convertirJsonAObjeto,
  obtenerAccionNegocio,
} from '@/modules/RRHH/solicitudes/helpers/historialSolicitud.helper';
import {
  leerMultipartSolicitud,
  limpiarSustentoSolicitud,
} from '@/modules/RRHH/solicitudes/helpers/multipartSolicitud.helper';
import {
  construirFiltroConsulta,
  obtenerSolicitudOperativa,
  validarResponsable,
  verificarRevisorActivo,
} from '@/modules/RRHH/solicitudes/helpers/validacionesSolicitud.helper';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';

/**
 * Pruebas unitarias exhaustivas para los 5 helpers del módulo de Solicitudes RRHH siguiendo el patrón AAA (Arrange, Act, Assert).
 */
describe('RRHH Solicitudes - Helpers de Creación, Fechas, Historial, Multipart y Validaciones', () => {
  describe('creacionSolicitud.helper', () => {
    it('resolverEmpleadoSolicitante(): valida permisos por rol y aislamiento de legajo para EMPLEADO', () => {
      // Arrange & Act & Assert
      expect(resolverEmpleadoSolicitante({ empleado_id: 'emp-1' } as any, 'emp-1', 'EMPLEADO')).toBe('emp-1');
      expect(resolverEmpleadoSolicitante({ empleado_id: 'emp-2' } as any, 'emp-1', 'RRHH')).toBe('emp-2');

      expect(() => resolverEmpleadoSolicitante({} as any, 'emp-1', 'CONTADOR')).toThrow(ForbiddenException);
      expect(() => resolverEmpleadoSolicitante({ empleado_id: 'otro' } as any, 'emp-1', 'EMPLEADO')).toThrow(ForbiddenException);
      expect(() => resolverEmpleadoSolicitante({ observacion: 'Aprobado' } as any, 'emp-1', 'EMPLEADO')).toThrow(ForbiddenException);
      expect(() => resolverEmpleadoSolicitante({} as any, null, 'ADMIN')).toThrow(BadRequestException);
    });

    it('validarDatosSolicitud(): valida tipos, rangos de fechas, montos de adelanto y días de vacaciones', () => {
      // Arrange & Act
      const vac = validarDatosSolicitud({
        tipo: 'VACACIONES',
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-15',
        dias_solicitados: 15,
      } as any);
      const adelanto = validarDatosSolicitud({
        tipo: 'ADELANTO_SUELDO',
        monto: 500.5,
      } as any);

      // Assert
      expect(vac.tipo).toBe('VACACIONES');
      expect(adelanto.tipo).toBe('ADELANTO_SUELDO');

      expect(() => validarDatosSolicitud({ tipo: 'INEXISTENTE' } as any)).toThrow(BadRequestException);
      expect(() => validarDatosSolicitud({ tipo: 'VACACIONES', fecha_inicio: '2026-10-01' } as any)).toThrow(BadRequestException);
      expect(() =>
        validarDatosSolicitud({ tipo: 'VACACIONES', fecha_inicio: '2026-10-15', fecha_fin: '2026-10-01' } as any),
      ).toThrow(BadRequestException);
      expect(() => validarDatosSolicitud({ tipo: 'ADELANTO_SUELDO', monto: 0 } as any)).toThrow(BadRequestException);
      expect(() => validarDatosSolicitud({ tipo: 'ADELANTO_SUELDO', monto: 100.12345 } as any)).toThrow(BadRequestException);
      expect(() =>
        validarDatosSolicitud({
          tipo: 'VACACIONES',
          fecha_inicio: '2026-10-01',
          fecha_fin: '2026-10-15',
          dias_solicitados: 400,
        } as any),
      ).toThrow(BadRequestException);
    });

    it('generarCodigoCorrelativo() & esColisionDeCodigo(): genera correlativo anual y detecta P2002 en codigo', async () => {
      // Arrange
      const mockPrisma: any = {
        $queryRaw: jest.fn().mockResolvedValueOnce([{ ultima_secuencia: 9n }]),
      };
      const errP2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '7.0.0',
        meta: { target: ['codigo'] },
      });

      // Act
      const codigo = await generarCodigoCorrelativo(mockPrisma);

      // Assert
      expect(codigo).toMatch(/^SOL-\d{4}-010$/);
      expect(esColisionDeCodigo(errP2002)).toBe(true);
      expect(esColisionDeCodigo(new Error('Otro'))).toBe(false);
    });
  });

  describe('fechasSolicitud.helper', () => {
    it('Debe convertir fechas válidas, calcular límite de revisión, antigüedad y alertas de urgencia', () => {
      // Arrange
      const hoy = new Date('2026-09-15T00:00:00.000Z');

      // Act & Assert
      expect(convertirFechaSolicitud(null)).toBeNull();
      expect(convertirFechaSolicitud('2026-09-20')?.toISOString()).toBe('2026-09-20T00:00:00.000Z');
      expect(() => convertirFechaSolicitud('20/09/2026')).toThrow(BadRequestException);
      expect(() => convertirFechaSolicitud('2026-02-30')).toThrow(BadRequestException);

      expect(calcularFechaLimiteRevision(new Date('2026-09-20T00:00:00.000Z')).toISOString()).toBe('2026-09-19T00:00:00.000Z');
      expect(calcularFechaLimiteRevision(null)).toBeInstanceOf(Date);

      expect(calcularAntiguedad(null, hoy)).toBe('No registrada');
      expect(calcularAntiguedad(new Date('2026-10-01T00:00:00.000Z'), hoy)).toBe('Ingreso programado');
      expect(calcularAntiguedad(new Date('2026-09-01T00:00:00.000Z'), hoy)).toBe('Menos de 1 mes');
      expect(calcularAntiguedad(new Date('2026-06-20T00:00:00.000Z'), hoy)).toBe('2 meses');
      expect(calcularAntiguedad(new Date('2024-08-10T00:00:00.000Z'), hoy)).toBe('2 años 1 mes');

      expect(
        obtenerAlertaUrgencia(
          { estado: 'APROBADA', fecha_inicio: hoy, fecha_limite: hoy },
          hoy,
        ),
      ).toBeNull();
      expect(
        obtenerAlertaUrgencia(
          { estado: 'PENDIENTE', fecha_inicio: hoy, fecha_limite: null },
          hoy,
        )?.mensaje,
      ).toContain('período solicitado ya ha comenzado');
      expect(
        obtenerAlertaUrgencia(
          { estado: 'EN_REVISION', fecha_inicio: new Date('2026-09-30T00:00:00.000Z'), fecha_limite: hoy },
          hoy,
        )?.mensaje,
      ).toContain('fecha límite de revisión');
    });
  });

  describe('historialSolicitud.helper', () => {
    it('Debe mapear JSON a objeto y clasificar todas las acciones de negocio del ciclo de vida', () => {
      // Arrange, Act & Assert
      expect(convertirJsonAObjeto(null)).toEqual({});
      expect(convertirJsonAObjeto([1, 2] as any)).toEqual({});
      expect(convertirJsonAObjeto({ estado: 'PENDIENTE' })).toEqual({ estado: 'PENDIENTE' });

      expect(obtenerAccionNegocio('CREATE', {}, {})).toBe('CREADA');
      expect(obtenerAccionNegocio('DELETE', {}, {})).toBe('ELIMINADA');
      expect(obtenerAccionNegocio('UPDATE', { estado: 'PENDIENTE' }, { estado: 'EN_REVISION' })).toBe('INICIO_REVISION');
      expect(obtenerAccionNegocio('UPDATE', { estado: 'EN_REVISION' }, { estado: 'APROBADA' })).toBe('APROBADA');
      expect(obtenerAccionNegocio('UPDATE', { estado: 'EN_REVISION' }, { estado: 'RECHAZADA' })).toBe('RECHAZADA');
      expect(obtenerAccionNegocio('UPDATE', { estado: 'PENDIENTE' }, { estado: 'ANULADA' })).toBe('ANULADA');
      expect(obtenerAccionNegocio('UPDATE', { responsable_id: null }, { responsable_id: 'u1' })).toBe('ASIGNADA');
      expect(obtenerAccionNegocio('UPDATE', { responsable_id: 'u1' }, { responsable_id: 'u2' })).toBe('REASIGNADA');
      expect(obtenerAccionNegocio('UPDATE', { responsable_id: 'u1' }, { responsable_id: null })).toBe('DESASIGNADA');
      expect(obtenerAccionNegocio('UPDATE', { motivo: 'a' }, { motivo: 'b' })).toBe('ACTUALIZADA');
    });
  });

  describe('multipartSolicitud.helper', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it('Debe leer campos y archivo adjunto desde un stream multipart y convertir montos numéricos', async () => {
      // Arrange
      jest.spyOn(FileStorageUtil, 'guardarArchivoMultipart').mockResolvedValue('/archivos/sustentos/doc.pdf');
      jest.spyOn(FileStorageUtil, 'eliminarArchivo').mockResolvedValue(undefined);

      async function* mockParts() {
        yield { type: 'field', fieldname: 'tipo', value: 'ADELANTO_SUELDO', valueTruncated: false, fieldnameTruncated: false };
        yield { type: 'field', fieldname: 'monto', value: '750.50', valueTruncated: false, fieldnameTruncated: false };
        yield { type: 'field', fieldname: 'observacion', value: '', valueTruncated: false, fieldnameTruncated: false };
        yield {
          type: 'file',
          fieldname: 'archivo',
          filename: 'sustento.pdf',
          file: { resume: jest.fn() },
        };
      }

      // Act
      const res = await leerMultipartSolicitud({ parts: () => mockParts() } as any);

      // Assert
      expect(res.campos).toEqual({ tipo: 'ADELANTO_SUELDO', monto: 750.5 });
      expect(res.archivo).toEqual({ url: '/archivos/sustentos/doc.pdf', nombreOriginal: 'sustento.pdf' });
    });

    it('Debe limpiar el archivo temporal y transformar códigos de error de límites Fastify', async () => {
      // Arrange
      const eliminarSpy = jest.spyOn(FileStorageUtil, 'eliminarArchivo').mockResolvedValue(undefined);
      async function* mockPartsTooLarge() {
        const err: any = new Error('Too large');
        err.code = 'FST_REQ_FILE_TOO_LARGE';
        throw err;
      }

      // Act & Assert
      await expect(leerMultipartSolicitud({ parts: () => mockPartsTooLarge() } as any)).rejects.toThrow(
        PayloadTooLargeException,
      );
      await limpiarSustentoSolicitud('/archivos/sustentos/temp.pdf');
      expect(eliminarSpy).toHaveBeenCalledWith('/archivos/sustentos/temp.pdf');
    });
  });

  describe('validacionesSolicitud.helper', () => {
    it('Debe construir filtros por UUID o código SOL-YYYY-NNN y validar al responsable revisor', async () => {
      // Arrange
      const uuid = '019a0100-0000-7000-8000-000000000010';
      const mockPrisma: any = {
        solicitud: { findUnique: jest.fn().mockResolvedValueOnce({ id: uuid, estado: 'EN_REVISION', responsable_id: 'rev-1' }) },
        usuarios: { findUnique: jest.fn().mockResolvedValueOnce({ id: 'rev-1', rol: 'RRHH', activo: true, deleted_at: null }) },
      };

      // Act
      const filtroUuid = construirFiltroConsulta(uuid, 'emp-1', 'EMPLEADO');
      const filtroCodigo = construirFiltroConsulta('SOL-2026-005', null, 'ADMIN');
      const operativa = await obtenerSolicitudOperativa(mockPrisma, uuid);
      validarResponsable(operativa, 'rev-1');
      await verificarRevisorActivo(mockPrisma, 'rev-1');

      // Assert
      expect(filtroUuid).toMatchObject({ id: uuid, empleado_id: 'emp-1' });
      expect(filtroCodigo).toMatchObject({ codigo: 'SOL-2026-005' });

      expect(() => construirFiltroConsulta('invalido', null, 'ADMIN')).toThrow(BadRequestException);
      expect(() => construirFiltroConsulta('SOL-2026-001', null, 'EMPLEADO')).toThrow(ForbiddenException);
      expect(() => validarResponsable({ estado: 'PENDIENTE' } as any, 'rev-1')).toThrow(ConflictException);
      expect(() => validarResponsable({ estado: 'EN_REVISION', responsable_id: null } as any, 'rev-1')).toThrow(ConflictException);
      expect(() => validarResponsable({ estado: 'EN_REVISION', responsable_id: 'otro' } as any, 'rev-1')).toThrow(ForbiddenException);

      mockPrisma.solicitud.findUnique.mockResolvedValueOnce(null);
      await expect(obtenerSolicitudOperativa(mockPrisma, uuid)).rejects.toThrow(NotFoundException);

      mockPrisma.usuarios.findUnique.mockResolvedValueOnce({ id: 'u2', rol: 'EMPLEADO', activo: true, deleted_at: null });
      await expect(verificarRevisorActivo(mockPrisma, 'u2')).rejects.toThrow(ForbiddenException);
    });
  });
});

describe('ObtenerSolicitudesUseCase y ObtenerHistorialSolicitudUseCase (Pruebas de Cobertura de Ramas)', () => {
  const { ObtenerSolicitudesUseCase } = require('@/modules/RRHH/solicitudes/use-cases/obtenerSolicitudes.useCase');
  const { ObtenerHistorialSolicitudUseCase } = require('@/modules/RRHH/solicitudes/use-cases/obtenerHistorialSolicitud.useCase');
  const { BadRequestException, ForbiddenException, NotFoundException } = require('@nestjs/common');

  it('ObtenerSolicitudesUseCase: debería filtrar por rol, área, búsqueda, fechas y calcular conteos por estado', async () => {
    // Arrange
    const prismaMock = {
      solicitud: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sol-1',
            codigo: 'SOL-001',
            empleado_id: 'emp-1',
            tipo: 'VACACIONES',
            estado: 'PENDIENTE',
            fecha_inicio: new Date('2026-05-01T00:00:00.000Z'),
            fecha_fin: new Date('2026-05-05T00:00:00.000Z'),
            dias_solicitados: 5,
            monto: null,
            fecha_limite: null,
            created_at: new Date('2026-04-20T00:00:00.000Z'),
            responsable: { id: 'resp-1', empleados: { nombre: 'Ana', apellido: 'Díaz' } },
            empleados: {
              id: 'emp-1',
              nombre: 'Juan',
              apellido: 'Pérez',
              area: { id: 'a-1', nombre: 'TI' },
              cargo: { id: 'c-1', nombre: 'Dev' },
            },
          },
        ]),
      },
      $transaction: jest.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
    };
    const useCase = new ObtenerSolicitudesUseCase(prismaMock);

    // Act
    const res = await useCase.execute(
      {
        page: 1,
        limit: 10,
        estado: 'PENDIENTE',
        tipo: 'VACACIONES',
        area_id: 'a-1',
        search: 'Juan',
        fecha_desde: '2026-04-01',
        fecha_hasta: '2026-04-30',
      },
      'emp-1',
      'EMPLEADO',
    );
    const resSoloArea = await useCase.execute({ page: 1, limit: 10, area_id: 'a-1' }, null, 'RRHH');

    // Assert
    expect(res.data).toHaveLength(1);
    expect(res.data[0].colaborador.nombre_completo).toBe('Juan Pérez');
    expect(resSoloArea.meta.total).toBe(1);
    await expect(useCase.execute({ page: 1, limit: 10 }, null, 'ASISTENTE')).rejects.toThrow(ForbiddenException);
    await expect(useCase.execute({ page: 1, limit: 10 }, null, 'EMPLEADO')).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ page: 1, limit: 10, fecha_desde: 'fecha-mala' }, 'emp-1', 'RRHH')).rejects.toThrow(
      BadRequestException,
    );
    await expect(useCase.execute({ page: 1, limit: 10, fecha_desde: '2026-02-31' }, 'emp-1', 'RRHH')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('ObtenerHistorialSolicitudUseCase: debería retornar la traza de auditoría de una solicitud o lanzar NotFoundException', async () => {
    // Arrange
    const prismaMock = {
      solicitud: {
        findFirst: jest.fn().mockResolvedValueOnce({ id: 'sol-1' }).mockResolvedValueOnce(null),
      },
      audit_log: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'aud-1',
            accion: 'UPDATE',
            created_at: new Date('2026-04-21T00:00:00.000Z'),
            valores_antes: { estado: 'PENDIENTE', responsable_id: null, observacion: null },
            valores_despues: { estado: 'APROBADA', responsable_id: 'u-1', observacion: 'Conforme' },
            usuarios: { id: 'u-1', email: 'rrhh@jyp.pe', empleados: { nombre: 'Ana', apellido: 'Díaz' } },
          },
          {
            id: 'aud-2',
            accion: 'INSERT',
            created_at: new Date('2026-04-20T00:00:00.000Z'),
            valores_antes: null,
            valores_despues: { estado: 'PENDIENTE' },
            usuarios: null,
          },
        ]),
      },
    };
    const useCase = new ObtenerHistorialSolicitudUseCase(prismaMock);

    // Act
    const historial = await useCase.execute('SOL-2026-001', null, 'RRHH');

    // Assert
    expect(historial).toHaveLength(2);
    expect(historial[0].actor.nombre_completo).toBe('Ana Díaz');
    expect(historial[1].actor.nombre_completo).toBe('Sistema');
    await expect(useCase.execute('SOL-2026-999', null, 'RRHH')).rejects.toThrow(NotFoundException);
  });
});
