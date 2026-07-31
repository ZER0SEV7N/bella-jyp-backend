//src/modules/tareas/use-cases/crearTarea.useCase.ts
//Caso de uso para crear una nueva tarea en el sistema. 
//Se encarga de validar los datos de entrada, verificar la existencia del usuario asignado y registrar la tarea en la base de datos.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CrearTareaDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

@Injectable()
export class CrearTareaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(payload: CrearTareaDto, asignadoPorId: string) {
        try{
            //Validar que el usuario asignado exista y esté activo
            const usuarioAsignado = await this.prisma.usuarios.findUnique({ where: { id: payload.asignado_a } });

            if(!usuarioAsignado || !usuarioAsignado.activo || usuarioAsignado.deleted_at !== null) throw new NotFoundException({
                title: 'Usuario no encontrado',
                detail: 'El usuario al que intenta asignar la tarea no existe o ha sido desactivado/eliminado.',
            });

            //Crear la tarea en la base de datos
            const nuevaTarea = await this.prisma.tareas_asistente.create({
                data: {
                    id: IdentityGenerator.generateId(),
                    asignado_a: payload.asignado_a,
                    asignado_por: asignadoPorId,
                    titulo: payload.titulo,
                    descripcion: payload.descripcion || null,
                    fecha_entrega: payload.fecha_entrega ? new Date(payload.fecha_entrega) : null,
                    estado: 'PENDIENTE',
                },
            });
            
            return nuevaTarea;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException('Error al registrar la asignacion de la tarea.');
        }
    }
}