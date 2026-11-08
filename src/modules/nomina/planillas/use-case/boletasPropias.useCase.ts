//src/modules/nomina/planillas/use-case/boletasPropias.useCase.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { DescargarBoletaUseCase } from './descargarBoleta.useCase';

/**
 * Caso de uso para listar y descargar boletas propias de un usuario.
 * Proporciona métodos para obtener un listado de boletas y para descargar el archivo PDF de una boleta específica.
 * Se asegura de que el usuario solo pueda acceder a sus propias boletas y maneja la validación de existencia y pertenencia.
 */
@Injectable()
export class BoletasPropiasUseCase {
    constructor(
        private readonly prisma: PrismaService,
        private readonly descargar: DescargarBoletaUseCase
    ) {}

    /**
     * Lista las boletas propias de un usuario, filtrando por estado y asegurando que solo se devuelvan boletas pertenecientes al usuario.
     * @param usuarioId - El ID del usuario para el cual se listarán las boletas.
     * @returns - Una promesa que resuelve con un arreglo de boletas, cada una con su ID, periodo, neto a pagar y estado.
     */
    listar(usuarioId: string) {
        // Filtra las boletas por estado y pertenencia al usuario, limitando el resultado a las últimas 120 boletas.
        return this.prisma.historial_planillas.findMany({
            where: {
                deleted_at: null,
                estado: { in: ['CONGELADO', 'DECLARADO'] },
                empleados: { usuarios: { id: usuarioId } },
            },
            select: {
                id: true,
                periodo: true,
                neto_a_pagar: true,
                estado: true,
            },
            orderBy: { periodo: 'desc' },
            take: 120,
        });
    }

    /**
     * Descarga el archivo PDF de una boleta específica, asegurando que la boleta pertenece al usuario y que existe.
     * @param id - El ID de la boleta que se desea descargar.
     * @param usuarioId - El ID del usuario que solicita la descarga, utilizado para verificar la pertenencia de la boleta.
     * @returns - Una promesa que resuelve con el archivo PDF de la boleta si existe y pertenece al usuario; de lo contrario, lanza una excepción NotFoundException.
     * @throws - NotFoundException si la boleta no existe o no pertenece al usuario.
     */
    async archivo(id: string, usuarioId: string) {
        // Verifica que la boleta exista y que pertenezca al usuario. Si no, lanza NotFoundException.
        const propia = await this.prisma.historial_planillas.findFirst({
            where: {
                id,
                deleted_at: null,
                empleados: { usuarios: { id: usuarioId } },
            },
            select: { id: true },
        });
        // La misma respuesta para inexistencia y falta de pertenencia evita revelar planillas ajenas.
        if (!propia)
            throw new NotFoundException('La boleta no está disponible para este usuario.');
        return this.descargar.execute(id);
    }
}
