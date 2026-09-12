import * as exceljs from 'exceljs';
import { PrismaService } from '@/common/prisma/prisma.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import { BadRequestException } from '@nestjs/common';

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)
//ZONA HORARIA
export const PERU_TIMEZONE = 'America/Lima';
//OBTENER RANGO DE FECHA DE LA SEMA 
const DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

function obtenerDiaSemana(hora : Date){
    const dia = dayjs(hora).tz(PERU_TIMEZONE).day();
    return DIAS_SEMANA[dia];
}

function obtenerRangoSemana(dia: Date)  {
    const fecha = dayjs(dia).tz(PERU_TIMEZONE);
    const inicioSemana = fecha.startOf('isoWeek').utc().toDate();
    const finalSemana = fecha.endOf('isoWeek').utc().toDate();
    return {inicioSemana, finalSemana}
}

export async function generarExcel(asistencias_con_emp: any) {
    const hoja_excel = new  exceljs.Workbook();
    const sheet = hoja_excel.addWorksheet('Asistencias');  
    sheet.columns = [
        { header: 'Item', key: 'item', width: 6 },
        { header: 'N° Documento', key: 'dni', width: 15 },
        { header: 'Nombre', key: 'nombre', width: 20 },
        { header: 'Apellido', key: 'apellido', width: 20 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'DIA', key:'dia' , width: 10},
        { header: 'ENTRADA', key: 'entrada', width: 12 },
        { header: 'SALIDA_ALMUERZO', key: 'salida_almuerzo', width: 16 },
        { header: 'ENTRADA_ALMUERZO', key: 'entrada_almuerzo', width: 16 },
        { header: 'SALIDA', key: 'salida', width: 12 },
    ];
    //agurapr datos en diccionari con map
    const grupos = new Map<string, {
        dni: string;
        nombre: string;
        apellido: string;
        fecha: string;
        dia_semana: string;
        entrada?: string;
        salida_almuerzo?: string;
        entrada_almuerzo?: string;
        salida?: string;
    }>();
    //inciar la escritura y recorrer el contenido
    asistencias_con_emp.forEach((registro) => {
        const fechaLocal = dayjs(registro.fecha_hora).tz(PERU_TIMEZONE);
        const fechaFormateada = fechaLocal.format('DD/MM/YYYY');
        const clave = `${registro.empleados.nro_documento}-${fechaFormateada}`;
        const dia_semana = obtenerDiaSemana(registro.fecha_hora);
        if (!grupos.has(clave)) {
            grupos.set(clave, {
                dni: registro.empleados.nro_documento,
                nombre: registro.empleados.nombre,
                apellido: registro.empleados.apellido,
                fecha: fechaFormateada,
                dia_semana: dia_semana,
            });
        }
        //AEGURAR LSO DATOS INDEFICINIDOS SEAN RECONOCIDOS POR TYEPSCRIPT
        const grupo = grupos.get(clave)!
        //FOMRATER LA FECHA A HORA
        const horaFormateada = fechaLocal.format('HH:mm');
        //PONER LOS DATOS DE HORA DEACUERDO A LA COLUMAN
        switch (registro.tipo_marcacion) {
            case 'ENTRADA':
                grupo.entrada = horaFormateada;
                break;
            case 'SALIDA_ALMUERZO':
                grupo.salida_almuerzo = horaFormateada;
                break;
            case 'ENTRADA_ALMUERZO':
                grupo.entrada_almuerzo = horaFormateada;
                break;
            case 'SALIDA':
                grupo.salida = horaFormateada;
                break;
        }
    });

    let contador_item = 0;
    grupos.forEach((grupo) => {
        contador_item++;
        sheet.addRow({
        item: contador_item,
        dni: grupo.dni,
        nombre: grupo.nombre,
        apellido: grupo.apellido,
        fecha: grupo.fecha,
        dia: grupo.dia_semana,
        entrada: grupo.entrada ?? '-',
        salida_almuerzo: grupo.salida_almuerzo ?? '-',
        entrada_almuerzo: grupo.entrada_almuerzo ?? '-',
        salida: grupo.salida ?? '-',
        });
    })

    return hoja_excel.xlsx.writeBuffer();
}
//TRAER ASISTENCIAS DE LOS EMPLEAOD DE UNA AREA
export async function traerAsistenciaDeEmpleados(prisma: PrismaService, area:string, fecha: Date){
    //Obtner rango de fechas
    const { inicioSemana, finalSemana } = obtenerRangoSemana(fecha);
    //VALIDAR QUE LA FECHA NO SEA ANTES DE TEMRINAR LA SEMANA ABORAL
    
    const ahora = dayjs().tz(PERU_TIMEZONE);
    
    if(dayjs(finalSemana).isAfter(ahora)) throw new BadRequestException('No se puede generar el reporte de una semana que aún no ha finalizado');
    
    //traer asistencia de los daots de empleado
    const empleados_asitencias = await prisma.asistencia_marcacion.findMany({
        where : {
            empleados :{
                area_id: area,
                activo: true,
                deleted_at: null,
            },
            fecha_hora:{
                gte:inicioSemana,
                lte:finalSemana,
            }
        },
        select:{
            empleados:{
                select:{
                    nro_documento: true,
                    nombre: true,
                    apellido: true,
                }
            },
            fecha_hora:true,
            tipo_marcacion:true,
        }     
    });
    return empleados_asitencias;
}