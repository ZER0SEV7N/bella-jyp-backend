import { Injectable, NotFoundException } from "@nestjs/common";
import { generarExcel, traerAsistenciaDeEmpleados } from './helper/crearReporteAsistencia'
import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class generarReporteSemanalUseCase{
    constructor(
        private readonly prisma: PrismaService
    ){}

    async execute( dto: any){       
        const asistencia_empleado = await traerAsistenciaDeEmpleados(this.prisma,dto.areaID, dto.fecha);
        if (asistencia_empleado.length === 0) {
           throw new NotFoundException('No se encontraron asistencias para el área y fecha indicadas');
        }
        const buffer = await generarExcel(asistencia_empleado);
        return buffer; 
    }
}