import { PrismaService } from "@/common/prisma/prisma.service";
import { CargaMasivaAsistenciaFileDto } from "@jyp/shared-contracts";
import { BadRequestException, Injectable } from "@nestjs/common";
import { obtenerMes, separarHoras, PERU_TIMEZONE } from "./helper/cargaMasiva"; // Asegúrate de exportar PERU_TIMEZONE si es necesario
import { IdentityGenerator } from "@/common/utils/uuid.util";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class ProcesarFilaUseCase {
    constructor(
        private readonly prisma: PrismaService
    ) {}

    async execute(empleadoId: string, filas: CargaMasivaAsistenciaFileDto) {
        const horasSeparadas = separarHoras(filas);
        
        // Corregido: si la longitud es 0, no hay horas que procesar
        if (horasSeparadas.length === 0) {
            throw new BadRequestException('No hay horas que separar');
        }
        // Obtener la fecha base (ej. "2026-06-06")
        const fechaBase = obtenerMes();
        // MAPEAR LOS DATOS
        const horasMapeada = horasSeparadas.map((item) => {
            const fechaHoraUtc = dayjs.tz(`${fechaBase} ${item.horaStr}`, PERU_TIMEZONE).utc().toDate();
            return {
                id: IdentityGenerator.generateId(),
                empleado_id: empleadoId,
                fecha_hora: fechaHoraUtc,
                tipo_marcacion: item.tipo as any,
                metodo: 'CARGA_MASIVA',
            };
        });

        return await this.prisma.asistencia_marcacion.createMany({
            data: horasMapeada,
            skipDuplicates: true,
        });
    }
}