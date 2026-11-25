//test/common/filters/rfc7807-exception.filter.spec.ts
import { Rfc7807ExceptionFilter } from '@/common/filters/rfc7807-exception.filter';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FastifyRequest } from 'fastify';

/**
 * Pruebas unitarias para el filtro de excepciones RFC 7807.
 * Este filtro se encarga de capturar excepciones lanzadas en el backend y formatearlas
 * según el estándar RFC 7807, proporcionando una estructura consistente para los errores.
 * Se incluyen casos de prueba para excepciones estándar, excepciones personalizadas y errores no manejados.
 * Se verifica que la respuesta tenga el formato correcto y que se manejen adecuadamente los códigos de estado HTTP.
 */
describe('Rfc7807ExceptionFilter - Pruebas Unitarias de Formateo de Errores', () => {
  //Instancia del filtro y mocks para FastifyReply, FastifyRequest y ArgumentsHost
  let filter: Rfc7807ExceptionFilter;
  let mockReply: { status: jest.Mock; send: jest.Mock };
  let mockRequest: FastifyRequest;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  //Configuración de mocks antes de cada prueba
  beforeEach(() => {
    filter = new Rfc7807ExceptionFilter();

    //Mock para FastifyReply con métodos status y send simulados
    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    //Mock para FastifyRequest con URL simulada
    mockRequest = {
      url: '/api/rrhh/empleados',
    } as unknown as FastifyRequest;

    //Mock para ArgumentsHost que devuelve los mocks de Request y Reply
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockReply,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    //Mock para Logger.prototype.error para evitar salida en consola y verificar el registro
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    //Los errores de negocio se registran como advertencia; también se silencian en las pruebas.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('catch() - Formateo Estándar RFC 7807', () => {
    it('Debe capturar una HttpException estándar y formatearla en estructura RFC 7807', () => {
      //Act: Simulación de una excepción HttpException con mensaje y código de estado 401
      const httpException = new HttpException(
        'Acceso no autorizado',
        HttpStatus.UNAUTHORIZED
      );

      //Call: Invocación del método catch del filtro con la excepción simulada y el host mockeado
      filter.catch(httpException, mockHost);

      //Assert: Verificación de que el método status y send del mockReply fueron llamados con los valores esperados
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.jyp.com/errors/401',
          title: 'HttpException',
          status: HttpStatus.UNAUTHORIZED,
          detail: 'Acceso no autorizado',
          instance: '/api/rrhh/empleados',
          timestamp: expect.any(String) as unknown,
        })
      );
    });

    it('Debe preservar el formato RFC 7807 si la excepción ya posee un objeto pre-formateado (Auth / Custom)', () => {
      //Act: Simulación de una excepción HttpException personalizada con detalles específicos
      const customException = new HttpException(
        {
          type: 'https://api.jyp.com/errors/token-expired',
          title: 'Token Expirado',
          detail: 'Su sesión ha caducado por inactividad.',
          instance: '/api/rrhh/empleados',
        },
        HttpStatus.UNAUTHORIZED
      );

      //Call: Invocación del método catch del filtro con la excepción personalizada y el host mockeado
      filter.catch(customException, mockHost);

      //Assert: Verificación de que el método status y send del mockReply fueron llamados con los valores esperados
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.jyp.com/errors/token-expired',
          title: 'Token Expirado',
          status: HttpStatus.UNAUTHORIZED,
          detail: 'Su sesión ha caducado por inactividad.',
          instance: '/api/rrhh/empleados',
        })
      );
    });

    it('Debe capturar errores no manejados (ej. Error de JS o BD) y retornar status 500 sin exponer datos sensibles', () => {
      //Act: Simulación de un error genérico (ej. pérdida de conexión a la base de datos)
      const genericError = new Error('Database connection lost');

      //Call: Invocación del método catch del filtro con el error genérico y el host mockeado
      filter.catch(genericError, mockHost);

      //Assert: Verificación de que Logger.error fue llamado con el error, y que el método status y send del mockReply fueron llamados con los valores esperados
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[undefined /api/rrhh/empleados] Error no manejado:',
        genericError.stack
      );
      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'https://api.jyp.com/errors/internal-server-error',
          title: 'Error Interno del Servidor',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          detail: 'Ocurrió un error inesperado en el servidor.',
          instance: '/api/rrhh/empleados',
        })
      );
    });
  });

  describe('catch() - Errores de Prisma y de negocio', () => {
    /**
     * Construye un error conocido de Prisma con el código y metadatos indicados.
     */
    const errorPrisma = (
      code: string,
      meta?: Record<string, unknown>,
      message = 'Error de Prisma'
    ) =>
      new Prisma.PrismaClientKnownRequestError(message, {
        code,
        clientVersion: 'test',
        meta,
      });

    it('P2021 responde 500 y no expone el nombre de la tabla faltante', () => {
      //Arrange
      const error = errorPrisma('P2021', { table: 'integracion_trabajo' });

      //Act
      filter.catch(error, mockHost);

      //Assert
      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      const llamadas = mockReply.send.mock.calls as unknown as Array<
        [{ detail: string }]
      >;
      expect(llamadas[0][0].detail).not.toContain('integracion_trabajo');
      //El nombre de la tabla sí queda en el log, para diagnosticar el despliegue.
      expect(
        loggerErrorSpy.mock.calls.some(([mensaje]) =>
          String(mensaje).includes('integracion_trabajo')
        )
      ).toBe(true);
    });

    it('P2023 responde 400 por un identificador con formato inválido', () => {
      //Act
      filter.catch(errorPrisma('P2023'), mockHost);

      //Assert
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('P2024 responde 503 por saturación del pool de conexiones', () => {
      //Act
      filter.catch(errorPrisma('P2024'), mockHost);

      //Assert
      expect(mockReply.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE
      );
    });

    it('P2010 traduce el mensaje del trigger a un conflicto de negocio', () => {
      //Arrange: el trigger devuelve texto plano dentro de meta.message
      const error = errorPrisma('P2010', {
        message: 'PLANILLA_BLOQUEADA: el período 2026-11 es inmutable.',
      });

      //Act
      filter.catch(error, mockHost);

      //Assert
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Planilla no modificable',
          status: HttpStatus.CONFLICT,
        })
      );
    });

    it('traduce un Error crudo con marca de planilla bloqueada a 409', () => {
      //Arrange: algunos drivers propagan el texto del trigger sin envolverlo en Prisma
      const error = new Error(
        'ASISTENCIA_BLOQUEADA: la planilla del período no está abierta.'
      );

      //Act
      filter.catch(error, mockHost);

      //Assert
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Asistencia no modificable',
          status: HttpStatus.CONFLICT,
        })
      );
    });
  });
});
