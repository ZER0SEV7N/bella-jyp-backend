//src/modules/RRHH/solicitudes/use-cases/obtenerHistorialSolicitud.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

type RegistroAuditoria = Record<string, unknown>;

function convertirJsonAObjeto(valor: Prisma.JsonValue | null): RegistroAuditoria {
    if(valor && typeof valor === 'object' && !Array.isArray(valor)) 
        return valor as RegistroAuditoria;

    return {};
}

function obtenerAccionNegocio(accionDb: string, antes: RegistroAuditoria, despues: RegistroAuditoria): string {
    if (accionDb === 'CREATE') 
        return 'CREADA';
    

    const estadoAnterior =antes.estado as string | undefined;

    const estadoNuevo = despues.estado as string | undefined;

    const responsableAnterior = antes.responsable_id as | string | null | undefined;

    const responsableNuevo = despues.responsable_id as | string | null| undefined;

    if ( responsableAnterior !== responsableNuevo) {
        if (responsableAnterior && responsableNuevo ) 
            return 'REASIGNADA';
        
        if (responsableNuevo) 
            return 'ASIGNADA';
    }

    if (estadoAnterior !== estadoNuevo && estadoNuevo) {
        switch (estadoNuevo) {
            case 'EN_REVISION':
                return 'INICIO_REVISION';

            case 'APROBADA':
                return 'APROBADA';

            case 'RECHAZADA':
                return 'RECHAZADA';

            case 'ANULADA':
                return 'ANULADA';
        }
    }

    return 'ACTUALIZADA';
}

@Injectable()
export class ObtenerHistorialSolicitudUseCase {

    constructor(private readonly prisma: PrismaService) {}

    async execute(solicitudId: string) {
        const auditorias = await this.prisma.audit_log.findMany({
            where: { tabla_afectada: 'solicitud', registro_id: solicitudId},
            orderBy: { created_at: 'asc' },
            include: {
                usuarios: {
                    select: {
                        id: true,
                        email: true,
                        empleados: { select: { nombre: true, apellido: true } }
                    }
                }
            }
        });

        return auditorias.map((registro) => {

            const antes = convertirJsonAObjeto(registro.valores_antes);
            const despues = convertirJsonAObjeto(registro.valores_despues);

            return {
                id: registro.id,

                accion: obtenerAccionNegocio(registro.accion, antes, despues ),
                fecha:registro.created_at,
                actor: registro.usuarios ? {
                    id: registro.usuarios.id,
                    email: registro.usuarios.email,
                    nombre_completo: `${registro.usuarios.empleados?.nombre ?? ''} ${registro.usuarios.empleados?.apellido ?? ''}`.trim()
                } : {
                    id: null,
                    email: null,
                    nombre_completo: 'Sistema'
                },

                cambios: {
                    estado: {
                        anterior: antes.estado ?? null,
                        nuevo: despues.estado ?? null
                    },

                    responsable_id: {
                        anterior: antes.responsable_id ?? null,

                        nuevo: despues.responsable_id ??null
                    }
                }
            };
        });
    }
}