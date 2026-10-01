//src/modules/asistencia/use-cases/asistencias/crearMarcacionManual.useCase.ts
import { PrismaService } from "@/common/prisma/prisma.service";
import { MarcarAsistenciaDto } from "@jyp/shared-contracts";
import { ConflictException, Injectable } from "@nestjs/common";
import { convertirAUtc, obtenerColaborador, validarExistencia} from "./helper/procesarAsistenciaWeb.helper";
import { IdentityGenerator } from "@/common/utils/uuid.util";
import { tipo_marcacion_enum } from "@prisma/client";

/**
 * Caso de uso para crear una marcación manual de asistencia para un empleado.
 * Este caso de uso valida la existencia del empleado, convierte la fecha y hora a UTC,
 * verifica la duplicidad de la marcación y finalmente inserta el registro en la base de datos.
 */
@Injectable()
export class CrearMarcacionManualUseCase{
    constructor(private readonly prisma:PrismaService){}

    /**
     * Ejecuta el caso de uso para crear una marcación manual de asistencia.
     * @param dto - Objeto de transferencia de datos que contiene la información necesaria para crear la marcación, 
     * incluyendo el número de documento del empleado, la fecha y hora de la marcación, y el tipo de marcación.
     * @returns - Una promesa que resuelve con el objeto de la marcación creada en la base de datos.
     * @throws ConflictException - Si ya existe una marcación para el mismo empleado, fecha y tipo de marcación.
     */
    async execute(dto:MarcarAsistenciaDto){
        //Validar existencia del colaborador
        const empleado = await obtenerColaborador(this.prisma, dto.nro_documento);

        //Convertir hora a UTC respetando zona horaria de Perú
        const fecha = convertirAUtc(dto.fecha_hora);

        //Validar duplicidad
        const yaExiste = await validarExistencia(this.prisma, empleado, fecha, dto.tipo_marcacion);
        if (yaExiste) throw new ConflictException({
            title: 'Marcación Duplicada',
            detail: 'Ya existe una marcación registrada para este colaborador con la misma fecha y tipo.',
        });
        

        // 4. Inserción con casteo estricto al enum de Prisma
        return await this.prisma.asistencia_marcacion.create({
            data: {
                id: IdentityGenerator.generateId(),
                fecha_hora: fecha,
                tipo_marcacion: dto.tipo_marcacion as tipo_marcacion_enum, // <-- Soluciona ts(2322)
                empleado_id: empleado.id,
                metodo: "MANUAL"
            }
        });
    }
}