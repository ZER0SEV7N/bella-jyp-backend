import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import type { MultipartFile } from '@fastify/multipart';
import { BadRequestException, Injectable } from '@nestjs/common';
import { prepararImportacion } from '../../helpers/preparar-importacion.helper';
import { ImportarMarcacionesService } from '../../services/importar-marcaciones.service';

/** Solicita la importación solamente si todas las filas superan la validación. */
@Injectable()
export class ImportarMarcacionesUseCase {
    constructor(private readonly prisma: PrismaService, private readonly importador: ImportarMarcacionesService) {}
    async execute(archivo: MultipartFile, actor: ActorOperacion) {
        const preparada = await prepararImportacion(this.prisma, archivo);
        const errores = preparada.vista.errores;
        if (errores.length)
            throw new BadRequestException({
                title: 'Excel con errores',
                detail: 'No se importó ninguna fila. Corrija los errores antes de confirmar.',
                errores
            });
        return this.importador.guardar(preparada, actor);
    }
}
