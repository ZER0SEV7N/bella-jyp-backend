import { PrismaService } from "@/common/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
@Injectable()
export class ValidarDniUseCase{
    constructor(
        private readonly prisma: PrismaService 
    ){}
    /**
     * funcion de vlaidar si el dni esta disponible o no.
     * @param nro_documento - parametro de entrar que es nro del documento.
     * @returns un json indicando si esta diponible o no el dni a registrar.
    */
    async execute(nro_documento:string){

        //validar si hay un empleado registrado con el dni
        const empleado = await this.prisma.empleados.findUnique({
            where:{
                nro_documento
            },
            select:{
                id:true,
                activo:true,
                estado_laboral:true,
            }
        });
        //retorno de respuesta de si no esta disponible o si esta disponible  
        return empleado? {disponible: false, empleado: empleado}: {disponible: true};
    }
}