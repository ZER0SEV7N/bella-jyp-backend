//src/modules/payroll/datoFinanciero/use-case/helper/validacionesDatoFinanciero.helper.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CryptoUtil } from '@/common/utils/crypto.util';

/**
 * Valida la existencia de un empleado y la preexistencia de un dato financiero activo.
 * @param prisma - Instancia del servicio Prisma para acceder a la base de datos.
 * @param empleadoId - ID del empleado a validar.
 * @returns void si el empleado existe y no tiene un dato financiero activo.
 * @throws NotFoundException si el empleado no existe o ha sido dado de baja.
 */
export async function validarEmpleadoYPreexistencia(prisma: PrismaService, empleadoId: string): Promise<void> {
    //Validar existencia de empleado
    const empleado = await prisma.empleados.findUnique({ where: { id: empleadoId, deleted_at: null }, select: { id: true } });

    if (!empleado) throw new NotFoundException({
        title: 'Empleado no encontrado',
        detail: 'El colaborador no existe o ha sido dado de baja.'
    });

    //Validar que no exista un dato financiero activo para el empleado
    const datoExistente = await prisma.dato_financiero.findFirst({where: { empleado_id: empleadoId, deleted_at: null }, select: { id: true } });

    if (datoExistente) throw new ConflictException({
        title: 'Dato Financiero Existente',
        detail: 'El colaborador ya cuenta con una ficha financiera activa.'
    });
}

/**
 * Valida de forma concurrente que el régimen de pensión, la AFP y los bancos existan.
 * Compatible con payloads completos (creación) o parciales (edición).
 */
export async function validarEntidadesFinancieras(prisma: PrismaService,
  ids: {
    id_regimen?: string;
    id_tipo_afp?: string | null;
    id_banco_sueldo?: string | null;
    id_banco_cts?: string | null;
  }): Promise<void> {
    
    //Crear un array de promesas para validar cada entidad de forma concurrente
    const promesas: Promise<any>[] = [];

    //Validar existencia de régimen de pensión, tipo de AFP y bancos si se proporcionan
    if (ids.id_regimen) promesas.push(
        prisma.regimen_pension.findUnique({ where: { id: ids.id_regimen } }).then((regimen) => {
            if (!regimen) throw new NotFoundException('El régimen de pensión especificado no existe.');
        }));
    
    //Validar existencia de tipo de AFP si se proporciona
    if (ids.id_tipo_afp) promesas.push(
        prisma.tipo_afp.findUnique({ where: { id: ids.id_tipo_afp } }).then((afp) => {
            if (!afp) throw new NotFoundException('El tipo de AFP especificado no existe.');
    }));
    
    //Validar existencia de bancos si se proporcionan
    if (ids.id_banco_sueldo) promesas.push(
        prisma.bancos.findUnique({ where: { id: ids.id_banco_sueldo } }).then((banco) => {
            if (!banco) throw new NotFoundException('El banco para abono de sueldo no existe.');
    }));
    
    //Validar existencia de banco CTS si se proporciona
    if (ids.id_banco_cts) promesas.push(
        prisma.bancos.findUnique({ where: { id: ids.id_banco_cts } }).then((banco) => {
            if (!banco) throw new NotFoundException('El banco para depósito de CTS no existe.');
    }));
    
    await Promise.all(promesas);
}

/**
 * Encripta campos bancarios sensibles (AES-256-GCM) de forma segura para Prisma:
 * - Si es undefined: retorna undefined (evita sobrescribir en updates).
 * - Si es null o vacío: retorna null (limpia en BD).
 * - Si tiene texto: lo recorta y retorna cifrado.
 */
export function encriptarDatoBancario(valor?: string | null): string | null | undefined {
  if (valor === undefined) return undefined;
  if (!valor || valor.trim() === '') return null;
  return CryptoUtil.encrypt(valor.trim());
}