import { PrismaService } from "@/common/prisma/prisma.service";
import { MarcarAsistenciaDto } from "@jyp/shared-contracts";
import { BadGatewayException, Injectable } from "@nestjs/common";
import { convertirAUtc, obtenerColaborador, validarExistencia, validarTipo } from "./helper/procesarWeb.helper";
import { IdentityGenerator } from "@/common/utils/uuid.util";

@Injectable()
export class CrearMarcacionManualUseCase{
    constructor(
        private readonly prisma:PrismaService
    )
    {}
    async execute(dto:MarcarAsistenciaDto){
        //valiar empleado  
        const empleado = await obtenerColaborador(this.prisma, dto.nro_documento);        
        //Vlaidar tipo de marcacion
        if(!validarTipo(dto.tipo_marcacion)){
            throw new BadGatewayException("el tipo de marcacion no es valido")
        }
        const fecha = convertirAUtc(dto.fecha_hora);
        await validarExistencia(this.prisma,empleado, fecha,dto.tipo_marcacion);
        return await this.prisma.asistencia_marcacion.create({
            data:{
                id:IdentityGenerator.generateId(),
                fecha_hora: fecha,
                tipo_marcacion: dto.tipo_marcacion,
                empleado_id:empleado.id,
                metodo: "MANUAL"
            }
        });
    }
}