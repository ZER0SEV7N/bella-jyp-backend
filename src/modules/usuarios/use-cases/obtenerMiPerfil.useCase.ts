//src/modules/usuarios/use-cases/obtenerMiPerfil.useCase.ts
import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { MiPerfilResponseDto } from '@jyp/shared-contracts';

/** 
 * Caso de uso para obtener el perfil del usuario
 */
@Injectable()
export class ObtenerMiPerfilUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async obtenerPerfil(userId: string): Promise<MiPerfilResponseDto> {
        try{
            //Buscar el usuario por su ID
            const usuario = await this.prisma.usuarios.findUnique({where: {id: userId},
            //Obtener estrictamente los campos necesarios para el perfil
                select: {
                    id: true,
                    email: true,
                    rol: true,
                    ultimo_acceso: true,
                    empleados: {
                        select: {
                            id: true,
                            nro_documento: true,
                            nombre: true,
                            apellido: true,
                            cargo: {select: {nombre: true} },
                            area: {select: {nombre: true} }
                        }
                    }
                }
            });

            //Si no se encuentra el usuario, lanzar una excepción
            if(!usuario) throw new NotFoundException('Usuario no encontrado');

            //Formatear la respuesta para el frontend
            return {
                id: usuario.id,
                email: usuario.email,
                rol: usuario.rol,
                ultimo_acceso: usuario.ultimo_acceso,
                empleado: usuario.empleados ? {
                    id: usuario.empleados.id,
                    nro_documento: usuario.empleados.nro_documento,
                    nombre_completo: `${usuario.empleados.nombre} ${usuario.empleados.apellido}`,
                    cargo: usuario.empleados.cargo.nombre,
                    area: usuario.empleados.area.nombre
                } : null
            };
        }catch (error) {
            if(error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Error al obtener el perfil del usuario');
        }
    }
}