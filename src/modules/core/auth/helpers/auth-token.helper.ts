//src/modules/core/auth/helpers/auth-token.helper.ts
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';

/**
 * Hash Argon2id ficticio precalculado para igualar el tiempo de respuesta cuando el usuario no existe en Login (AUTH-F4).
 */
export const DUMMY_ARGON2_HASH = '$argon2id$v=19$m=65536,t=3,p=4$cjjyqWmM/JP6RuxgsOuCkg$4sbNNyU65nGiOsQ09aklpubeEflNzxGIJO3zDBa7Eh8';

/**
 * Roles que cada rol administrador puede aprovisionar o asignar (AUTH-F1).
 * - `JYP` y `ADMIN`: pueden asignar `ADMIN`, `RRHH`, `CONTADOR`, `ASISTENTE` y `EMPLEADO` (nunca `JYP`).
 * - `RRHH`: solo puede asignar `EMPLEADO` y `ASISTENTE` (no puede escalar privilegios a `ADMIN` ni `CONTADOR`).
 */
const ROLES_PERMITIDOS_POR_ACTOR: Record<string, ReadonlySet<string>> = {
  JYP: new Set(['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE', 'EMPLEADO']),
  ADMIN: new Set(['ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE', 'EMPLEADO']),
  RRHH: new Set(['ASISTENTE', 'EMPLEADO']),
};

/**
 * Valida la jerarquía de roles al aprovisionar un usuario o cambiar su rol (AUTH-F1).
 * @param rolActor - Rol del usuario autenticado que ejecuta la operación.
 * @param rolObjetivo - Rol que se desea asignar.
 */
export function validarJerarquiaProvision(rolActor: string | undefined, rolObjetivo: string): void {
  if (rolObjetivo === 'JYP') {
    throw new ForbiddenException('El rol JYP se provisiona exclusivamente desde la administración del software.');
  }

  // Si hay un actor autenticado, se verifica que su rol tenga permiso para asignar el rol objetivo
  if (rolActor) {
    const permitidos = ROLES_PERMITIDOS_POR_ACTOR[rolActor];
    if (!permitidos?.has(rolObjetivo)) 
      throw new ForbiddenException(`El rol ${rolActor} no tiene privilegios para aprovisionar o asignar cuentas con rol ${rolObjetivo}.`,);
    
  }
}

/**
 * Construye de manera única y consistente el payload de los tokens JWT (Access y Refresh) (AUTH-F5).
 * Evita discrepancias entre Login y Refresh (como colocar `empleado_id` en el campo `doc`).
 */
export function construirPayloadJwt(usuario: {
  id: string;
  email: string;
  rol: string;
  empleado_id: string;
  empleados?: {
    nombre?: string | null;
    apellido?: string | null;
    nro_documento?: string | null;
  } | null;
}) {
  const nombreCompleto = usuario.empleados
    ? `${usuario.empleados.nombre ?? ''} ${usuario.empleados.apellido ?? ''}`.trim()
    : 'Usuario del Sistema';

  return {
    sub: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    doc: usuario.empleados?.nro_documento ?? null,
    empId: usuario.empleado_id,
    nombre: nombreCompleto,
  };
}

/**
 * Obtiene un secreto JWT obligatorio desde el entorno sin usar valores quemados en el código fuente (COM-F1).
 */
export function obtenerSecretoJwt(tipo: 'ACCESS' | 'REFRESH'): string {
  const variable = tipo === 'ACCESS' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET';
  const valor = process.env[variable];
  if (!valor) {
    if (process.env.NODE_ENV === 'test') 
      return `test_${variable.toLowerCase()}_32_characters_minimum_key`;
    
    throw new InternalServerErrorException(`CRÍTICO: La variable ${variable} no está configurada.`);
  }
  return valor;
}
