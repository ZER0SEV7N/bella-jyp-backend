//test/common/errors/errores-negocio.spec.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  mensajeDeError,
  traducirErrorNegocio,
} from '@/common/errors/errores-negocio';

/**
 * Pruebas unitarias del catálogo de errores de negocio.
 * Verifican que cada marca textual de PostgreSQL se traduzca al código HTTP correcto y que
 * los mensajes desconocidos no se conviertan en falsos positivos.
 */
describe('errores-negocio - Traducción de mensajes técnicos', () => {
  //Arrange: mensajes representativos de los triggers y reglas de dominio.
  const casos: ReadonlyArray<[string, number]> = [
    [
      'PLANILLA_BLOQUEADA: el período 2026-11 es inmutable.',
      HttpStatus.CONFLICT,
    ],
    [
      'ASISTENCIA_BLOQUEADA: la planilla del período 2026-11 no está abierta.',
      HttpStatus.CONFLICT,
    ],
    ['La novedad ya está resuelta.', HttpStatus.CONFLICT],
    [
      'La novedad original se conserva; anule y registre una nueva si debe corregirla.',
      HttpStatus.CONFLICT,
    ],
    [
      'La resolución de una novedad corresponde a un contador activo.',
      HttpStatus.FORBIDDEN,
    ],
    [
      'El desembolso debe corresponder al monto y colaborador de un adelanto aprobado.',
      HttpStatus.CONFLICT,
    ],
    ['Las vigencias del parámetro 2026 se superponen.', HttpStatus.CONFLICT],
    ['Las vigencias AFP se superponen.', HttpStatus.CONFLICT],
    ['Parámetro negativo o fechas invertidas.', HttpStatus.BAD_REQUEST],
    ['Tasa, tope o vigencia AFP inválidos.', HttpStatus.BAD_REQUEST],
    [
      'La solicitud de asistencia aprobada requiere ambas fechas.',
      HttpStatus.BAD_REQUEST,
    ],
    ['El intervalo excede el alcance de un año.', HttpStatus.BAD_REQUEST],
  ];

  it.each(casos)('traduce "%s" a HTTP %i', (mensaje, statusEsperado) => {
    //Act
    const excepcion = traducirErrorNegocio(mensaje);

    //Assert
    expect(excepcion).toBeInstanceOf(HttpException);
    expect(excepcion?.getStatus()).toBe(statusEsperado);
    expect(
      (excepcion?.getResponse() as { detail: string }).detail
    ).toBeTruthy();
  });

  it('devuelve null para un mensaje que no es de negocio', () => {
    //Act & Assert: un error de infraestructura no debe disfrazarse de 4xx
    expect(traducirErrorNegocio('Database connection lost')).toBeNull();
  });

  it('devuelve null para un mensaje vacío', () => {
    //Act & Assert
    expect(traducirErrorNegocio('')).toBeNull();
  });

  describe('mensajeDeError', () => {
    it('extrae el mensaje de una instancia de Error', () => {
      //Act & Assert
      expect(mensajeDeError(new Error('falló el trigger'))).toBe(
        'falló el trigger'
      );
    });

    it('devuelve el texto cuando el error ya es una cadena', () => {
      //Act & Assert
      expect(mensajeDeError('texto crudo de PostgreSQL')).toBe(
        'texto crudo de PostgreSQL'
      );
    });

    it('devuelve cadena vacía para valores sin mensaje', () => {
      //Act & Assert
      expect(mensajeDeError({ code: 'P2010' })).toBe('');
    });
  });
});
