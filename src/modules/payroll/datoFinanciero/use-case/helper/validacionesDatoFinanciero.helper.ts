//src/modules/payroll/datoFinanciero/use-case/helper/validacionesDatoFinanciero.helper.ts
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Helper para validar la existencia de entidades financieras en la base de datos utilizando Prisma.
 * Este helper se utiliza en los casos de uso relacionados con la gestión de datos financieros, como la creación o actualización de registros que dependen de entidades financieras.
 */

/**
 * Valida la existencia de entidades financieras en la base de datos utilizando Prisma.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param ids - Objeto que contiene los identificadores de las entidades financieras a validar.
 * @throws NotFoundException si alguna de las entidades no existe en la base de datos.
 * @returns Promise<void> - Una promesa que se resuelve si todas las entidades existen, o se rechaza con una excepción si alguna no existe.
 */
export async function validarEntidadesFinancieras(prisma: PrismaService, ids: {
    id_regimen?: string;
    id_tipo_afp?: string | null;
    id_banco_sueldo?: string | null;
    id_banco_cts?: string | null;
}): Promise<void> {
    //Crear un array de promesas para validar cada entidad de forma concurrente
    const promesas: Promise<any>[] = [];

    //Validar existencia de régimen de pensión, tipo de AFP y bancos si se proporcionan
    if (ids.id_regimen)
        promesas.push(prisma.regimen_pension.findUnique({ where: { id: ids.id_regimen } }).then((regimen) => {
            if (!regimen) 
                throw new NotFoundException('El régimen de pensión especificado no existe.');
    }));

    //Validar existencia de tipo de AFP si se proporciona
    if (ids.id_tipo_afp)
        promesas.push(prisma.tipo_afp.findUnique({ where: { id: ids.id_tipo_afp } }).then((afp) => {
            if (!afp) 
                throw new NotFoundException('El tipo de AFP especificado no existe.');
    }));

    //Validar existencia de bancos si se proporcionan
    if (ids.id_banco_sueldo)
        promesas.push(prisma.bancos.findUnique({ where: { id: ids.id_banco_sueldo } }).then((banco) => {
            if (!banco) 
                throw new NotFoundException('El banco para abono de sueldo no existe.');
    }));

    //Validar existencia de banco CTS si se proporciona
    if (ids.id_banco_cts)
        promesas.push(prisma.bancos.findUnique({ where: { id: ids.id_banco_cts } }).then((banco) => {
            if (!banco) 
                throw new NotFoundException('El banco para depósito de CTS no existe.');
    }));

    await Promise.all(promesas);
}