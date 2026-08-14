//src/modules/RRHH/contrato/use-cases/subirContratoPdf.useCase.ts
import { Injectable, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';

/**
 * Caso de uso para subir un archivo PDF de contrato en el módulo de RRHH
 * Contiene la lógica de negocio para subir un archivo PDF a un almacenamiento externo y actualizar la base de datos con la ruta del archivo.
 * Se encarga de recibir el ID del contrato y el archivo PDF, validar su existencia y tipo, subirlo al almacenamiento y actualizar la base de datos.
 */

@Injectable()
export class SubirContratoPdfUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para subir un archivo PDF de contrato
     * @param idContrato El ID del contrato al que se asociará el archivo PDF
     * @param fileData Los datos del archivo PDF a subir
     * @returns Una promesa que resuelve con la información del contrato actualizado
     * @throws NotFoundException si el contrato no existe o ya ha sido eliminado
     * @throws BadRequestException si el archivo no es un PDF válido
     * @throws InternalServerErrorException si ocurre un error al subir el archivo o actualizar la base de datos
     */
    async execute(idContrato: string, fileData: any) {
        //Verificar que el contrato existe y no ha sido eliminado
        const contrato = await this.prisma.contratos.findUnique({ where: { id: idContrato } });

        if(!contrato || contrato.deleted_at !== null) throw new NotFoundException('Contrato no encontrado o ha sido anulado.');

        //Si el contrato ya tiene un PDF asociado, lanzar un error
        if(contrato.url !== null) throw new BadRequestException('El contrato ya tiene un PDF asociado. No se puede subir otro.');

        try {
            //Guardar el archivo fisicamente usando Fastify Streams
            const fileUrl = await FileStorageUtil.guardarArchivoMultipart(fileData, 'contratos');

            //Enlazar la ruta del archivo en la base de datos
            const contratoActualizado = await this.prisma.contratos.update({
                where: { id: idContrato },
                data: {
                    url: fileUrl,
                    observacion: contrato.observacion 
                        ? `${contrato.observacion} | PDF adjunto el ${new Date().toISOString()}`
                        : `PDF adjunto el ${new Date().toISOString()}`
                }
            });
               
            return {
                message: 'Documento subido y vinculado correctamente. El contrato ya no puede ser editado.',
                url: fileUrl
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error; // Respetar errores de la utilidad (ej. Formato inválido)
        
        throw new InternalServerErrorException(
            'Ocurrió un error en el servidor al intentar guardar el archivo físico.',
            error instanceof Error ? error.message : String(error)
        );
        }    
    }
}