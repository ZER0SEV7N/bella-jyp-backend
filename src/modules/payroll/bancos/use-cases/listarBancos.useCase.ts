//src/modules/payroll/bancos/use-cases/listarBancos.useCase.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class ListarBancosUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para listar todos los bancos activos en orden alfabético.
     * @returns Una promesa que resuelve con un arreglo de objetos que representan los bancos, incluyendo su id, nombre, código y estado de actividad.
     */
    async execute() {
        return await this.prisma.bancos.findMany({
            orderBy: { nombre: 'asc' },
            select: {
                id: true,
                nombre: true
            }
        });
    }
}