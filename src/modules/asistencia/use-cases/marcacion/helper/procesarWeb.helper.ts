//LIBRERIAS
import { PrismaService } from "@/common/prisma/prisma.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { IdentityGenerator } from "@/common/utils/uuid.util";
import { TipoMarcacion } from "@jyp/shared-contracts";
dayjs.extend(utc);
dayjs.extend(timezone);
//TIME ZONE
export const PERU_TIMEZONE = 'America/Lima';
//OBTENER PERIODO ACTUAL "YYYY-MM"
export function obtenerFecha(): string {
    return dayjs().tz(PERU_TIMEZONE).format('YYYY-MM');
}
//TRAER EL EMPLEADO PARA ASISTENCIA
export async function obtenerColaborador(prisma: PrismaService, dni: string){
    const empleado = await prisma.empleados.findFirst({
        where: {
            nro_documento: dni,
            activo: true,
            deleted_at: null,
        },
        select: {
            id: true,
        }
    });

    if (!empleado) {
        throw new NotFoundException("Empleado no encontrado o inactivo");
    }
    return empleado;
}

//VALIDAR ENUM
export function validarTipo(tipoMarcacion: string): tipoMarcacion is TipoMarcacion {
    return Object.values(TipoMarcacion).includes(tipoMarcacion as TipoMarcacion);
}

function convertirAUtc(hora: Date): Date {
    return dayjs.tz(hora, PERU_TIMEZONE).utc().toDate();
}

//VERIFICAR SI YA EXISTE UNA MARCACION IGUAL (evitar duplicados)
export async function validarExistencia(prisma: PrismaService, emp: any, fecha: Date, tipo: TipoMarcacion,
){
    const registro = await prisma.asistencia_marcacion.findFirst({
        where: {
            empleado_id: emp.id,
            fecha_hora: fecha,
            tipo_marcacion: tipo,
        },
        select: {
            empleado_id: true,
        }
    });

    return !!registro;
}

//REGISTRAR MARCACION MANUAL (DESDE LA APP)
export async function AsistenciaApp(prisma: PrismaService, emp: any, hora: Date, tipo: string,) {
    
    if (!validarTipo(tipo)) {
        throw new BadRequestException(`Tipo de marcación inválido: ${tipo}`);
    }

    const fecha = convertirAUtc(hora);

    if (await validarExistencia(prisma, emp, fecha, tipo)) {
        throw new BadRequestException("Ya existe una marcación registrada en ese horario");
    }

    return prisma.asistencia_marcacion.create({
        data: {
            id: IdentityGenerator.generateId(),
            fecha_hora: fecha,
            tipo_marcacion: tipo,
            empleado_id: emp,
            metodo: "MANUAL",
        },
    });
}