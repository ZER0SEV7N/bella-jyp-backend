//src/modules/RRHH/organizacion/use-cases/empleado/crearEmpleado.useCase.ts
//Caso de uso para crear un empleado en el módulo de RRHH
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Optional
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { ReniecAdapter } from '../../services/reniec.adapter';
import type { CrearEmpleadoDto } from '@jyp/shared-contracts';
import {
  sanitizarTexto,
  sanitizarFecha,
} from '@/common/utils/transformacion.util';
import { verificarDocumentoUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';
import {
  validarEntidadesEmpleado,
  encontrarIdentidad,
} from './helper/validacionesEmpleado';
import { ClsService } from 'nestjs-cls';
import { CLS_USER_ID } from '@/common/cls/cls.constants';
import { sincronizarJornadaInicialEmpleado } from '@/modules/RRHH/common/sincronizar-jornada-inicial.helper';

/**
 * Caso de uso para crear un nuevo empleado en el sistema.
 * Este caso de uso valida los datos proporcionados,
 * verifica la existencia de referencias relacionadas y, si es necesario, consulta a RENIEC para completar la información del empleado.
 */
@Injectable()
export class CrearEmpleadoUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reniecAdapter: ReniecAdapter,
    @Optional() private readonly cls?: ClsService,
) {}

  /**
   * Crea un nuevo empleado en el sistema (COM-F3).
   * @param dto - Objeto que contiene los datos del empleado a crear.
   * @returns El empleado creado con sus datos completos.
   * @throws {HttpException} Si falla alguna validación de negocio o entidad relacionada.
   * @throws {InternalServerErrorException} Si ocurre un error inesperado al registrar el colaborador.
   */
  async execute(dto: CrearEmpleadoDto) {
    try {
      //Esperar las validaciones de documento único y de entidades relacionadas antes de crear el empleado
      await verificarDocumentoUnico(this.prisma, dto.nro_documento);
      await validarEntidadesEmpleado(this.prisma, dto);

      // Consultar a RENIEC para obtener el nombre y apellido del empleado si no se proporcionan
      const { nombre, apellido } = await encontrarIdentidad(
        this.reniecAdapter,
        dto.nro_documento,
        dto.nombre,
        dto.apellido
      );

      // Normalizar y sanitizar los datos del empleado antes de almacenarlos
      const fechaInicio = new Date(dto.fecha_inicio);
      const usuarioId = this.cls?.get<string>(CLS_USER_ID);

      // Ejecutar la transacción para crear el empleado y sincronizar su jornada inicial
      return await this.prisma.$transaction(async (tx) => {
        const empleado = await tx.empleados.create({
          data: {
            id: IdentityGenerator.generateId(),
            cargo_id: dto.cargo_id,
            area_id: dto.area_id,
            documento_id: dto.documento_id,
            estado_laboral: 'ACTIVO',
            jornada_id: dto.jornada_id ?? null,
            nro_documento: dto.nro_documento.trim(),
            nombre,
            apellido,
            email: dto.email.trim(),
            telefono: dto.telefono.trim(),
            sexo: dto.sexo,
            estado_civil: dto.estado_civil ?? 'SOLTERO',
            nacionalidad: sanitizarTexto(dto.nacionalidad) ?? 'PERUANA',
            direccion: dto.direccion.trim(),
            referencia_direccion: dto.referencia_direccion.trim(),
            ubigeo: dto.ubigeo.trim(),
            distrito: dto.distrito.trim(),
            provincia: dto.provincia.trim(),
            departamento: dto.departamento.trim(),
            fecha_nacimiento: new Date(dto.fecha_nacimiento),
            fecha_inicio: fechaInicio,
            afp_fecha_filiacion: sanitizarFecha(dto.afp_fecha_filiacion),
            asig_familiar: dto.asig_familiar ?? false,
            activo: true,
            estado_sincronizacion: 'COMPLETO',
          },
          include: {
            area: { select: { id: true, nombre: true } },
            cargo: { select: { id: true, nombre: true } },
            jornada: { select: { id: true, nombre: true } },
          },
        });

        await sincronizarJornadaInicialEmpleado(tx, {
          empleadoId: empleado.id,
          jornadaId: empleado.jornada_id,
          fechaInicio,
          usuarioId,
        });

        return empleado;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al Registrar Colaborador',
        detail:
          error instanceof Error
            ? error.message
            : 'Fallo interno al intentar crear el legajo del colaborador.',
      });
    }
  }
}
