//src/modules/RRHH/organizacion/use-cases/derechohabiente/subirSustento.useCase.ts
import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { sanitizarFecha } from '@/common/utils/transformacion.util';
import type { SubirSustentoDerechohabienteDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para subir un sustento documental asociado a un derechohabiente.
 * Este caso de uso valida la existencia del derechohabiente, 
 * asegura que el archivo proporcionado cumpla con los requisitos de formato y tamaño,
 * y almacena el archivo en el sistema de almacenamiento configurado.
 * Finalmente, actualiza la referencia al sustento en la base de datos.
 */
@Injectable()
export class SubirSustentoDerechohabienteUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Metodo principal para ejecutar el caso de uso de subida de sustento documental.
     * @param dto Objeto de transferencia de datos que contiene la información del derechohabiente y el tipo de sustento a subir.
     * @param fileData Datos del archivo a subir, incluyendo nombre, tipo MIME y contenido binario.
     * @throws NotFoundException si el derechohabiente no existe.
     * @throws BadRequestException si el archivo no cumple con los requisitos de formato o tamaño.
     * @throws InternalServerErrorException si ocurre un error al almacenar el archivo o actualizar la base de datos.
     */
    async execute(dto: SubirSustentoDerechohabienteDto, fileData: any) {
        try{
            const derechoHabiente = await this.prisma.derechohabientes.findUnique({ where: { id: dto.derechohabiente_id, deleted_at: null } });

            if(!derechoHabiente) throw new NotFoundException({
                title: 'Derechohabiente no encontrado',
                detail: 'El familiar especificado no existe o ha sido dado de baja.'
            });

            //Almacenamiento local mediante streaming (PDF / DOCX hasta 5MB)
            const archivoUrl = await FileStorageUtil.guardarArchivoMultipart(fileData, 'derechohabientes');

            //Registrar la referencia del sustento en la base de datos
            const nombreOriginal = fileData.filename ? String(fileData.filename).slice(0, 150) : 'documento_sustento.pdf';

            //Registrar la referencia del sustento en la base de datos
            return await this.prisma.derechohabiente_documentos.create({
                data: {
                    id: IdentityGenerator.generateId(),
                    derechohabiente_id: dto.derechohabiente_id,
                    tipo_documento: dto.tipo_documento,
                    nombre_archivo: nombreOriginal,
                    archivo_url: archivoUrl,
                    fecha_emision: sanitizarFecha(dto.fecha_emision),
                    fecha_vencimiento: sanitizarFecha(dto.fecha_vencimiento),
                    vigente: true
                }
            });
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;

            throw new InternalServerErrorException({
                title: 'Error al Subir Sustento',
                detail: error instanceof Error ? error.message : 'Fallo interno al registrar el documento sustento.'
            });
        }
    }
}