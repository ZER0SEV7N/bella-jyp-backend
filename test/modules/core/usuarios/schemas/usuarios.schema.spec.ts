//test/modules/core/usuarios/schemas/usuarios.schema.spec.ts
import {
  CambiarEstadoUsuarioSchema,
  CambiarRolUsuarioSchema,
  ListarUsuariosQuerySchema,
} from '@/modules/core/usuarios/schemas/usuarios.schema';

/**
 * Pruebas unitarias de los contratos de entrada del módulo de usuarios (USR-F2).
 * El objetivo es que un query o cuerpo inválido responda 400 antes de llegar a Prisma.
 */
describe('usuarios.schema - Contratos de entrada', () => {
  describe('ListarUsuariosQuerySchema', () => {
    it('normaliza page, limit, activo y search desde el query string', () => {
      //Act
      const resultado = ListarUsuariosQuerySchema.parse({
        page: '2',
        limit: '10',
        rol: 'ADMIN',
        activo: 'false',
        search: '  ana  ',
      });

      //Assert
      expect(resultado).toEqual({
        page: 2,
        limit: 10,
        rol: 'ADMIN',
        activo: false,
        search: 'ana',
      });
    });

    it('acepta un query vacío', () => {
      //Act & Assert
      expect(ListarUsuariosQuerySchema.parse({})).toEqual({});
    });

    it('rechaza un rol inexistente', () => {
      //Act
      const resultado = ListarUsuariosQuerySchema.safeParse({ rol: 'FOO' });

      //Assert
      expect(resultado.success).toBe(false);
    });

    it('rechaza un activo que no sea "true" o "false"', () => {
      //Act
      const resultado = ListarUsuariosQuerySchema.safeParse({ activo: '1' });

      //Assert
      expect(resultado.success).toBe(false);
    });

    it('rechaza un límite mayor a 100', () => {
      //Act
      const resultado = ListarUsuariosQuerySchema.safeParse({ limit: '101' });

      //Assert
      expect(resultado.success).toBe(false);
    });
  });

  describe('CambiarEstadoUsuarioSchema', () => {
    it('acepta un booleano', () => {
      //Act & Assert
      expect(CambiarEstadoUsuarioSchema.parse({ activo: false })).toEqual({
        activo: false,
      });
    });

    it('rechaza la cadena "false" para que no active la cuenta por error', () => {
      //Act
      const resultado = CambiarEstadoUsuarioSchema.safeParse({
        activo: 'false',
      });

      //Assert
      expect(resultado.success).toBe(false);
    });
  });

  describe('CambiarRolUsuarioSchema', () => {
    it('acepta un rol válido', () => {
      //Act & Assert
      expect(CambiarRolUsuarioSchema.parse({ rol: 'CONTADOR' })).toEqual({
        rol: 'CONTADOR',
      });
    });

    it('rechaza un rol fuera del catálogo', () => {
      //Act
      const resultado = CambiarRolUsuarioSchema.safeParse({
        rol: 'SUPERADMIN',
      });

      //Assert
      expect(resultado.success).toBe(false);
    });
  });
});
