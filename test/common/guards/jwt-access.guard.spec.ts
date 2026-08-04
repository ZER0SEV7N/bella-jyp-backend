//test/common/guards/jwt-access.guard.spec.ts
//Pruebas unitarias para el guard de acceso con JWT
import { UnauthorizedException } from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';

describe('JwtAccessGuard', () => {
  let guard: JwtAccessGuard;

  beforeEach(() => {
    guard = new JwtAccessGuard();
  });

  describe('handleRequest', () => {
    it('Deberia retornar el usuario si la autenticación es exitosa', () => {
      //Arrange
      const mockUser = { id: '123', rol: 'ADMIN' };

      //Act
      const result = guard.handleRequest(null, mockUser, null);

      //Assert
      expect(result).toEqual(mockUser);
    });

    it('Deberia propagar el error original si passport lo envia', () => {
      //Arrange
      const originalError = new Error('Database timeout durante validacion');

      //Act & Assert
      expect(() => guard.handleRequest(originalError, null, null)).toThrow(
        originalError,
      );
    });

    it('Deberia lanzar UnauthorizedException si no hay usuario y no hay error', () => {
      //Act & Assert
      expect(() => guard.handleRequest(null, false, null)).toThrow(
        UnauthorizedException,
      );

      try {
        guard.handleRequest(null, false, null);
      } catch (error: any) {
        expect(error.response).toEqual({
          type: 'https://api.jyp.com/errors/unauthorized',
          title: 'Sesión Inválida o Expirada',
          status: 401,
          detail:
            'Debe proveer un Access Token válido para consumir este recurso.',
        });
      }
    });
  });
});
