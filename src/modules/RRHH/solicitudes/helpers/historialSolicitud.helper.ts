//src/modules/RRHH/solicitudes/helpers/historialSolicitud.helper.ts
import type { Prisma } from '@prisma/client';

//Definición de un tipo de registro de auditoría que representa un objeto con claves de tipo string y valores de tipo desconocido.
type RegistroAuditoria = Record<string, unknown>;

//Función que convierte un valor JSON de Prisma a un objeto de tipo RegistroAuditoria.
export function convertirJsonAObjeto(valor: Prisma.JsonValue | null): RegistroAuditoria {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as RegistroAuditoria;
    return {};
}

/**
 * Función que determina la acción de negocio basada en la acción de base de datos y los cambios en los datos.
 * @param accionDb - La acción de base de datos (CREATE, UPDATE, softDELETE).
 * @param antes - Los datos antes del cambio.
 * @param despues - Los datos después del cambio.
 * @returns - La acción de negocio correspondiente.
 */
export function obtenerAccionNegocio(accionDb: string, antes: RegistroAuditoria, despues: RegistroAuditoria): string {
    //Si la acción de base de datos es CREATE, devuelve 'CREADA'. Si es DELETE, devuelve 'ELIMINADA'.
    if (accionDb === 'CREATE') return 'CREADA';
    if (accionDb === 'DELETE') return 'ELIMINADA';

    //El cambio de estado representa la acción principal cuando también se asigna un responsable.
    if (antes.estado !== despues.estado) {
        switch (despues.estado) {
            case 'EN_REVISION': return 'INICIO_REVISION';
            case 'APROBADA': return 'APROBADA';
            case 'RECHAZADA': return 'RECHAZADA';
            case 'ANULADA': return 'ANULADA';
        }
    }

    
    //Si el responsable ha cambiado, determina si la solicitud ha sido reasignada, asignada o desasignada.
    if (antes.responsable_id !== despues.responsable_id) {
        if (antes.responsable_id && despues.responsable_id) return 'REASIGNADA';
        if (despues.responsable_id) return 'ASIGNADA';
        if (antes.responsable_id) return 'DESASIGNADA';
    }

    return 'ACTUALIZADA';
}
