import { PrismaService } from "@/common/prisma/prisma.service";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
export interface csv_columans {
    nro_empleado: string;
    fecha: string;           
    hora_entrada_1?: string; 
    hora_salida_1?: string;  
    hora_entrada_2?: string; 
    hora_salida_2?: string;  
}

export function generarCargaMasiva(empleadoId:string, prisma: PrismaService){

}
export function obtenerColaboradores(){

}