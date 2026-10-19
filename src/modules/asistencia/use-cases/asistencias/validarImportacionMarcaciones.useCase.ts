import { PrismaService } from '@/common/prisma/prisma.service';
import type { MultipartFile } from '@fastify/multipart';
import { Injectable } from '@nestjs/common';
import { prepararImportacion } from '../../helpers/preparar-importacion.helper';

/** Muestra los errores del archivo sin guardar marcaciones. */
@Injectable()
export class ValidarImportacionMarcacionesUseCase {
    constructor(private readonly prisma: PrismaService) {}
    async execute(archivo: MultipartFile) {
        const { vista } = await prepararImportacion(this.prisma, archivo);
        return { ...vista, confirmable: vista.errores.length === 0 };
    }
}
