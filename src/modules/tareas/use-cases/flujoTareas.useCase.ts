//src/modules/tareas/use-cases/flujoTareas.useCase.ts
//Caso de uso para manejar el flujo de tareas en el sistema.
//Se encarga de validar la existencia de la tarea, verificar el estado actual y actualizar el estado de la tarea según las reglas de negocio definidas.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CambiarEstadoTareaDto, CrearAnotacionDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

@Injectable()
export class FlujoTareasUseCase {
    constructor(private readonly prisma: PrismaService) {}

    //Metodo para Cambiar el estado de una tarea existente, aplicando las reglas de negocio según el rol del usuario que realiza la acción.
    async cambiarEstado(idTarea: string, payload: CambiarEstadoTareaDto, userId: string, rol: string){
        const tarea = await this.prisma.tareas_asistente.findUnique({ where: { id: idTarea } });

        if(!tarea || tarea.deleted_at !== null) throw new NotFoundException('La tarea no existe o fue eliminada.');

        //Regla de negocio: Un asistente no puede auto-aprobarse una tarea
        //Solo puede pasar a REVISION, y el CONTADOR debe aprobarla
        if(rol == 'ASISTENTE' && ['APROBADO', 'AUDITADO'].includes(payload.estado)) throw new BadRequestException({
          title: 'Accion no permitida',
          detail: 'Los asistentes solo pueden marcar las tareas como "En Revisión". La aprobación es exclusiva del Contador/Admin.',
        });

        return await this.prisma.tareas_asistente.update({
            where: { id: idTarea },
            data: { estado: payload.estado },
        });
    }

    //Metodo para agregar una anotacion (comentario) a una tarea existente, registrando el usuario que realiza la acción.
    async agregarAnotacion(idTarea: string, payload: CrearAnotacionDto, userId: string){
        const tarea = await this.prisma.tareas_asistente.findUnique({ where: { id: idTarea } });
        if(!tarea || tarea.deleted_at !== null) throw new NotFoundException('La tarea no existe o fue eliminada.');

        return await this.prisma.anotacion_tareas.create({
            data: {
                id: IdentityGenerator.generateId(),
                tarea_id: idTarea,
                asignado_por: userId,
                descripcion: payload.descripcion,
            },
        });
    }
}