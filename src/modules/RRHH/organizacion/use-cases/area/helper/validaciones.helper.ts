import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Valida que el nombre de un cargo sea único dentro de un área específica.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param nombreArea - Nombre del unico del  area a validar.
 * @param idExclude - ID del cargo a excluir de la validación (opcional).
 * @throws BadRequestException si ya existe otro cargo con el mismo nombre en el área especificada.
 */
export async function varificarNombreUnicoArea(prisma:PrismaService,nombreArea:string, idExclude: string) {
    const duplicado = await prisma.area.findFirst({
        where:{
            nombre:{ equals: nombreArea.trim(), mode:'insensitive'},
            activo:true,
            deleted_at:null,
            ...(idExclude? { id: { not: idExclude}}: {}),
        },
        select:{
            id:true,
        }
    });
 
    if(duplicado) throw new ConflictException(`Ya existe un área activa con el nombre "${nombreArea}".`)

}