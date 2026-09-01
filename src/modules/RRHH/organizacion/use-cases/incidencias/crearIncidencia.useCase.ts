import { PrismaService } from "@/common/prisma/prisma.service";
import { IdentityGenerator } from "@/common/utils/uuid.util";
import { crearIncidenciaDto } from "@jyp/shared-contracts";
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";


@Injectable()
export class CrearIncidenciaUseCase{
  constructor(private readonly prisma: PrismaService) {}

    async execute(payload: crearIncidenciaDto){
        //validar el empelado
    await this.validarEmpleado(payload.empleado_id);
        //crear incidencia
    try {
      return await this.prisma.incidencias_mes.create({ data: { id: IdentityGenerator.generateId(), ...payload} });

    } catch (error) {
        if (error instanceof InternalServerErrorException) throw error;
        throw new BadRequestException('Error al crear la jornada laboral.');
    }
  }

  private async validarEmpleado(idEmpleado: string) {
    const empleado = await this.prisma.empleados.findUnique({
      where: { id: idEmpleado },
    });
    if (!empleado) {
        throw new NotFoundException({
          message: `No se encontro empleado${idEmpleado}`
        })
    }
    if (!empleado.activo || empleado.deleted_at) {
        throw new BadRequestException({
            message: `El empleado de ${idEmpleado} se encuentra incativo o fue eliminado`
        })
    }
  }
}