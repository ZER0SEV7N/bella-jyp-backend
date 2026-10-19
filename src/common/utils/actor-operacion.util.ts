//src/common/utils/actor-operacion.util.ts
import type { FastifyRequest } from 'fastify';

/**
 * Utilidad para representar al actor que realiza una operación en el sistema, incluyendo su identificador y dirección IP.
 * La utilidad es utilizada en los casos de uso para registrar la auditoría de las operaciones realizadas por los usuarios en el calculo de planillas y otras operaciones críticas.
 */

/**
 * Representa al actor que realiza una operación en el sistema, incluyendo su identificador y dirección IP.
 * Este objeto se utiliza para registrar la auditoría de las operaciones realizadas por los usuarios.
 * @property id - Identificador único del actor que realiza la operación.
 * @property ip - Dirección IP desde la cual se realiza la operación.
 */
export interface ActorOperacion {
    id: string;
    ip: string;
}

//Representa una solicitud autenticada que contiene información del usuario autenticado, incluyendo su identificador y rol.
export type SolicitudAutenticada = FastifyRequest & { user: { id: string; rol: string } };

//Convierte una solicitud autenticada en un objeto ActorOperacion, extrayendo el identificador del usuario y la dirección IP de la solicitud.
export const actorSolicitud = (req: SolicitudAutenticada): ActorOperacion => ({ id: req.user.id, ip: req.ip });
