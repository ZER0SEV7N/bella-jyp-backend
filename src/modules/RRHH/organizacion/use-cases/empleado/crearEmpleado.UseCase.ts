//src/modules/RRHH/use-cases/empleado/crearEmpleado.UseCase.ts
//Caso de uso para crear un empleado en el módulo de RRHH
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { ReniecAdapter } from '../../services/reniec.adapter';
import type { CrearEmpleadoDto } from '@jyp/shared-contracts';
import { sanitizarTexto, sanitizarFecha } from '@/common/utils/transformacion.util';
import { verificarDocumentoUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';
import { validarEntidadesEmpleado, encontrarIdentidad } from './helper/validacionesEmpleado';

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
  ) {}

  /** 
   * Crea un nuevo empleado en el sistema.
   * @param dto - Objeto que contiene los datos del empleado a crear.
   * @returns El empleado creado con sus datos completos.
   */
  async execute(dto: CrearEmpleadoDto) {
    try {
      //Esperar las validaciones de documento único y de entidades relacionadas antes de crear el empleado
      await verificarDocumentoUnico(this.prisma, dto.nro_documento);
      await validarEntidadesEmpleado(this.prisma, dto);

      const { nombre, apellido } = await encontrarIdentidad(
        this.reniecAdapter,
        dto.nro_documento,
        dto.nombre,
        dto.apellido
      );

      //Crear el empleado en la base de datos
      return await this.prisma.empleados.create({
        data: {
          id: IdentityGenerator.generateId(),
          cargo_id: dto.cargo_id,
          area_id: dto.area_id,
          documento_id: dto.documento_id,
          estado_empleado_id: dto.estado_empleado_id,
          jornada_id: dto.jornada_id ?? null,
          nro_documento: dto.nro_documento.trim(),
          nombre,
          apellido,
          email: sanitizarTexto(dto.email),
          telefono: sanitizarTexto(dto.telefono),
          sexo: dto.sexo ?? null,
          estado_civil: dto.estado_civil ?? 'SOLTERO',
          nacionalidad: sanitizarTexto(dto.nacionalidad) ?? 'PERUANA',
          direccion: sanitizarTexto(dto.direccion),
          referencia_direccion: sanitizarTexto(dto.referencia_direccion),
          ubigeo: sanitizarTexto(dto.ubigeo),
          distrito: sanitizarTexto(dto.distrito),
          provincia: sanitizarTexto(dto.provincia),
          departamento: sanitizarTexto(dto.departamento),
          fecha_nacimiento: sanitizarFecha(dto.fecha_nacimiento),
          fecha_inicio: sanitizarFecha(dto.fecha_inicio),
          afp_fecha_filiacion: sanitizarFecha(dto.afp_fecha_filiacion),
          asig_familiar: dto.asig_familiar ?? false,
          activo: true,
          estado_sincronizacion: 'COMPLETO'
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
          estado_empleado: { select: { id: true, descripcion: true } },
          jornada: { select: { id: true, nombre: true } }
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException({
        title: 'Error al Registrar Colaborador',
        detail: error instanceof Error ? error.message : 'Fallo interno al intentar crear el legajo del colaborador.'
      });
    }
  }


}