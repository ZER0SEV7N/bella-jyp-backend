import { transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
//src/modules/rrhh/solicitudes/use-cases/crearSolicitud.useCase.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { rol_usuario_enum } from '@prisma/client';
import type { CrearSolicitudDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import {
  MAX_INTENTOS_CORRELATIVO,
  esColisionDeCodigo,
  generarCodigoCorrelativo,
  resolverEmpleadoSolicitante,
  validarDatosSolicitud,
} from '../helpers/creacionSolicitud.helper';
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
     * Además de crear la solicitud, este método valida que el empleado exista y esté activo,
     * y que los datos de entrada cumplan con las reglas de negocio definidas.
     * @param dto - Los datos de la solicitud a crear.
     * @param empleadoIdSesion - El ID del empleado que está creando la solicitud (opcional).
     * @param archivo - Objeto opcional que contiene la URL y el nombre original del archivo adjunto a la solicitud.
     * @param rol - Rol del usuario que está realizando la solicitud (ADMIN, RRHH o EMPLEADO).
     * @param actor - Objeto que representa al actor de la operación.
     * @returns - La solicitud creada con todos sus datos, incluyendo el código correlativo generado.
     * @throws {BadRequestException} Si los datos de entrada son inválidos.
     * @throws {NotFoundException} Si el empleado especificado no existe o está inactivo.
     */
    async execute(dto: CrearSolicitudDto, empleadoIdSesion: string | null, archivo?: { url: string; nombreOriginal: string }, rol: rol_usuario_enum = 'EMPLEADO', actor?: ActorOperacion) {
        // Resolver el ID del empleado solicitante según el rol y la sesión del usuario
        const empleadoId = resolverEmpleadoSolicitante(dto, empleadoIdSesion, rol);
        const { tipo, fechaInicio, fechaFin } = validarDatosSolicitud(dto);
        if (!actor) 
            throw new BadRequestException('Debe identificar al usuario que registra la solicitud.');
        

        //Validación del motivo de la solicitud: debe tener entre 5 y 1500 caracteres.
        if (typeof dto.motivo !== 'string' || dto.motivo.trim().length < 5 || dto.motivo.trim().length > 1500) 
            throw new BadRequestException('El motivo debe tener entre 5 y 1500 caracteres.');
        

        //Verifica que el empleado exista y esté activo en la base de datos.
        const empleado = await this.prisma.empleados.findUnique({
            where: { id: empleadoId, deleted_at: null },
            select: { id: true, activo: true },
        });

        //Si el empleado no existe o está inactivo, lanza una excepción de NotFoundException.
        if (!empleado?.activo) 
            throw new NotFoundException('El colaborador especificado no existe o se encuentra inactivo.');
        

        for (let intento = 1; intento <= MAX_INTENTOS_CORRELATIVO; intento++) {
            const codigo = await generarCodigoCorrelativo(this.prisma);

            try {
                return await transaccionAuditada(this.prisma, actor, (tx) =>
                tx.solicitud.create({
                    data: {
                    id: IdentityGenerator.generateId(),
                    empleado_id: empleadoId,
                    codigo,
                    tipo,
                    estado: 'PENDIENTE',
                    monto: tipo === 'ADELANTO_SUELDO' ? new Prisma.Decimal(String(dto.monto)) : null,
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin,

                    //No se inventa un día para trámites sin una duración indicada.
                    dias_solicitados: dto.dias_solicitados ?? null,
                    motivo: dto.motivo.trim(),
                    observacion: dto.observacion?.trim() || null,
                    hora_inicio: dto.hora_inicio ?? null,
                    hora_fin: dto.hora_fin ?? null,
                    sustento_url: archivo?.url ?? null,
                    sustento_nombre: archivo?.nombreOriginal ?? null,
                    fecha_limite: calcularFechaLimiteRevision(fechaInicio),
                    origen: rol === 'EMPLEADO' ? 'PORTAL_EMPLEADO' : 'MANUAL_RRHH',
                    },
                    include: SOLICITUD_INCLUDE,
                })
                );
            } catch (error) {
                //Si ocurre un error de colisión de código, se intenta generar un nuevo código y repetir la operación.
                if (!esColisionDeCodigo(error)) 
                    throw error;
                
                //Si se alcanza el número máximo de intentos, se lanza una excepción de conflicto indicando que no se pudo generar un código único.
                if (intento < MAX_INTENTOS_CORRELATIVO) 
                    continue;
                
                //Si se alcanza este punto, significa que no se pudo crear la solicitud después de varios intentos debido a colisiones de código.
                throw new ConflictException({
                    title: 'Conflicto de correlativo',
                    detail: 'No fue posible generar un código único. Intente nuevamente.',
                });
            }
        }

        //Si se alcanza este punto, significa que no se pudo crear la solicitud después de varios intentos debido a colisiones de código.
        throw new ConflictException('No fue posible registrar la solicitud.');
    }
}
