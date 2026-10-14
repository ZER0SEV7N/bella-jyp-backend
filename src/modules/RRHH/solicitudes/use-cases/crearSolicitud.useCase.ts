//src/modules/rrhh/solicitudes/use-cases/crearSolicitud.useCase.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { rol_usuario_enum } from '@prisma/client';
import type { CrearSolicitudDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { MAX_INTENTOS_CORRELATIVO, esColisionDeCodigo, generarCodigoCorrelativo, resolverEmpleadoSolicitante, validarDatosSolicitud } from '../helpers/creacionSolicitud.helper';
import { calcularFechaLimiteRevision } from '../helpers/fechasSolicitud.helper';
import { SOLICITUD_INCLUDE } from '../helpers/validacionesSolicitud.helper';

/**
 * Caso de uso para crear una nueva solicitud.
 * Este caso de uso tiene como objetivo validar los datos de entrada, 
 * generar un código correlativo único para la solicitud,
 * y persistir la nueva solicitud en la base de datos.
 */

@Injectable()
export class CrearSolicitudUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para crear una nueva solicitud.
     * @param dto - Objeto que contiene los datos de la solicitud a crear.
     * @param empleadoIdSesion - Identificador del empleado que está realizando la solicitud (puede ser null si el rol es ADMIN o RRHH).
     * @param archivo - Objeto opcional que contiene la URL y el nombre original del archivo adjunto a la solicitud.
     * @param rol - Rol del usuario que está realizando la solicitud (ADMIN, RRHH o EMPLEADO).
     * @returns 
     */
    async execute(dto: CrearSolicitudDto, empleadoIdSesion: string | null, archivo?: { url: string; nombreOriginal: string }, rol: rol_usuario_enum = 'EMPLEADO') {        const empleadoId = resolverEmpleadoSolicitante(dto, empleadoIdSesion, rol);
        const { tipo, fechaInicio, fechaFin } = validarDatosSolicitud(dto);

        //Validación del motivo de la solicitud: debe tener entre 5 y 1500 caracteres.
        if (typeof dto.motivo !== 'string' || dto.motivo.trim().length < 5 || dto.motivo.trim().length > 1500)
            throw new BadRequestException('El motivo debe tener entre 5 y 1500 caracteres.');

        //Verifica que el empleado exista y esté activo en la base de datos.
        const empleado = await this.prisma.empleados.findUnique({
            where: { id: empleadoId, deleted_at: null },
            select: { id: true, activo: true }
        });

        //Si el empleado no existe o está inactivo, lanza una excepción de NotFoundException.
        if (!empleado?.activo) throw new NotFoundException('El colaborador especificado no existe o se encuentra inactivo.');

        for (let intento = 1; intento <= MAX_INTENTOS_CORRELATIVO; intento++) {
            const codigo = await generarCodigoCorrelativo(this.prisma);

            try {
                return await this.prisma.solicitud.create({
                    data: {
                        id: IdentityGenerator.generateId(), empleado_id: empleadoId, codigo, tipo, estado: 'PENDIENTE',
                        monto: tipo === 'ADELANTO_SUELDO' ? new Prisma.Decimal(String(dto.monto)) : null,
                        fecha_inicio: fechaInicio, fecha_fin: fechaFin,
                        //No se inventa un día para trámites sin una duración indicada.
                        dias_solicitados: dto.dias_solicitados ?? null,
                        motivo: dto.motivo.trim(), observacion: dto.observacion?.trim() || null,
                        sustento_url: archivo?.url ?? null, sustento_nombre: archivo?.nombreOriginal ?? null,
                        fecha_limite: calcularFechaLimiteRevision(fechaInicio),
                        origen: rol === 'EMPLEADO' ? 'PORTAL_EMPLEADO' : 'MANUAL_RRHH'
                    },
                    include: SOLICITUD_INCLUDE
                });
            } catch (error) {
                if (!esColisionDeCodigo(error)) throw error;
                if (intento < MAX_INTENTOS_CORRELATIVO) continue;

                throw new ConflictException({ title: 'Conflicto de correlativo', detail: 'No fue posible generar un código único. Intente nuevamente.' });
            }
        }

        //Si se alcanza este punto, significa que no se pudo crear la solicitud después de varios intentos debido a colisiones de código.
        throw new ConflictException('No fue posible registrar la solicitud.');
    }
}