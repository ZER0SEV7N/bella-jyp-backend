//src/modules/RRHH/use-cases/empleado/crearEmpleadoCompleto.useCase.ts
import { CrearSchemaEmpleadoCompletoDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ReniecAdapter } from '../../services/reniec.adapter';
import { verificarDocumentoUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';
import { encontrarIdentidad, validarEntidadesEmpleado } from './helper/validacionesEmpleado';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { sanitizarFecha, sanitizarTexto } from '@/common/utils/transformacion.util';

/**
 * Caso de uso para crear un empleado completo: datos del empleado,
 * datos financieros (encriptados) y derechohabientes, todo en una sola operación atómica.
 */
@Injectable()
export class CrearEmpladoCompletoUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reniecAdapter: ReniecAdapter,
  ) {}

  /**
   * Crea un nuevo empleado con su información financiera y derechohabientes.
   * @param dto - Objeto que contiene los datos del empleado a crear.
   * @returns El empleado creado con sus datos completos.
   */
  async execute(dto: CrearSchemaEmpleadoCompletoDto) {
    try {
      // separación de bloques de datos del dto principal
      const empleado_datos = dto.datosEmpleado;
      const datos_financiero = dto.datosFinanciero;
      const derechos_habientes = dto.derechosHabientes ?? [];

      // ── Validaciones del empleado ──
      await verificarDocumentoUnico(this.prisma, empleado_datos.nro_documento);
      await validarEntidadesEmpleado(this.prisma, empleado_datos);
      const { nombre, apellido } = await encontrarIdentidad(
        this.reniecAdapter,
        empleado_datos.nro_documento,
        empleado_datos.nombre,
        empleado_datos.apellido,
      );

      const afpFechaFiliacion = sanitizarFecha(empleado_datos.afp_fecha_filiacion);

      // ── Validaciones financieras ──
      await this.validarPrevisionYBancos(datos_financiero, afpFechaFiliacion);

      // Activación automática de Asignación Familiar (Ley 25129)
      const generaAsignacionFamiliar = derechos_habientes.some(
        (dh) => dh.vinculo === 'HIJO_MENOR' || dh.vinculo === 'HIJO_MAYOR_ESTUDIANTE',
      );

      // ── Encriptación AES-256-GCM de cuentas y CCIs ──
      const nroCuentaSueldoEncrypted = CryptoUtil.encryptOptional(datos_financiero.nro_cuenta_sueldo);
      const cciSueldoEncrypted = CryptoUtil.encryptOptional(datos_financiero.cci_sueldo);
      const nroCuentaCtsEncrypted = CryptoUtil.encryptOptional(datos_financiero.nro_cuenta_cts);
      const cciCtsEncrypted = CryptoUtil.encryptOptional(datos_financiero.cci_cts);

      return await this.prisma.empleados.create({
        data: {
          id: IdentityGenerator.generateId(),
          cargo_id: empleado_datos.cargo_id,
          area_id: empleado_datos.area_id,
          documento_id: empleado_datos.documento_id,
          jornada_id: empleado_datos.jornada_id ?? null,
          estado_laboral: 'ACTIVO',
          nro_documento: empleado_datos.nro_documento.trim(),
          nombre,
          apellido,
          email: empleado_datos.email.trim(),
          telefono: empleado_datos.telefono.trim(),
          sexo: empleado_datos.sexo,
          estado_civil: empleado_datos.estado_civil ?? 'SOLTERO',
          nacionalidad: sanitizarTexto(empleado_datos.nacionalidad) ?? 'PERUANA',
          direccion: empleado_datos.direccion.trim(),
          referencia_direccion: empleado_datos.referencia_direccion.trim(),
          ubigeo: empleado_datos.ubigeo.trim(),
          distrito: empleado_datos.distrito.trim(),
          provincia: empleado_datos.provincia.trim(),
          departamento: empleado_datos.departamento.trim(),
          fecha_nacimiento: new Date(empleado_datos.fecha_nacimiento),
          fecha_inicio: new Date(empleado_datos.fecha_inicio),
          afp_fecha_filiacion: afpFechaFiliacion,
          asig_familiar: (empleado_datos.asig_familiar ?? false) || generaAsignacionFamiliar,
          activo: true,
          estado_sincronizacion: 'COMPLETO',

          dato_financiero: {
            create: {
              id: IdentityGenerator.generateId(),
              id_regimen: datos_financiero.id_regimen,
              id_tipo_afp: datos_financiero.id_tipo_afp ?? null,
              sueldo_basico: datos_financiero.sueldo_basico,
              cuspp: sanitizarTexto(datos_financiero.cuspp),
              tipo_comision: sanitizarTexto(datos_financiero.tipo_comision),

              // Sueldo
              id_banco_sueldo: datos_financiero.id_banco_sueldo ?? null,
              tipo_cuenta_sueldo: datos_financiero.tipo_cuenta_sueldo,
              nro_cuenta_sueldo: nroCuentaSueldoEncrypted,
              cci_sueldo: cciSueldoEncrypted,

              // CTS
              id_banco_cts: datos_financiero.id_banco_cts ?? null,
              tipo_cuenta_cts: datos_financiero.tipo_cuenta_cts,
              nro_cuenta_cts: nroCuentaCtsEncrypted,
              cci_cts: cciCtsEncrypted,

              // Régimen de Salud / EPS
              regimen_salud: datos_financiero.regimen_salud,
              eps_nombre: sanitizarTexto(datos_financiero.eps_nombre),
              eps_plan: sanitizarTexto(datos_financiero.eps_plan),
              eps_costo_adicional: datos_financiero.eps_costo_adicional ?? 0,
            },
          },

          derechohabientes: {
            create: derechos_habientes.map((dh) => ({
              id: IdentityGenerator.generateId(),
              documento_id: dh.documento_id,
              nro_documento: dh.nro_documento.trim(),
              nombres: sanitizarTexto(dh.nombres),
              apellidos: sanitizarTexto(dh.apellidos),
              vinculo: dh.vinculo,
              estado_civil: dh.estado_civil,
              sexo: dh.sexo,
              fecha_nacimiento: sanitizarFecha(dh.fecha_nacimiento)!,
              activo: true,
              acreditado_essalud: false,
            })),
          },
        },
        include: {
          area: { select: { id: true, nombre: true } },
          cargo: { select: { id: true, nombre: true } },
          jornada: { select: { id: true, nombre: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;

      throw new InternalServerErrorException({
        title: 'Error al Registrar Colaborador',
        detail: error instanceof Error ? error.message : 'Fallo interno al intentar crear el legajo del colaborador.',
      });
    }
  }

  /**
   * Valida la existencia de entidades foráneas de previsión y bancarias.
   * @param dto Datos financieros a registrar.
   * @param afiliacion Fecha de afiliación a la AFP (puede ser null).
   * @throws NotFoundException si alguna entidad no existe.
   * @throws BadRequestException si la AFP requiere información adicional no proporcionada.
   */
  private async validarPrevisionYBancos(
    dto: CrearSchemaEmpleadoCompletoDto['datosFinanciero'],
    afiliacion: Date | null,
  ): Promise<void> {
    // Se realizan consultas en paralelo para verificar la existencia de las entidades relacionadas con el régimen de pensión, tipo de AFP y bancos.
    const [regimen, tipoAfp, bancoSueldo, bancoCts] = await Promise.all([
      this.prisma.regimen_pension.findUnique({ where: { id: dto.id_regimen } }),
      dto.id_tipo_afp ? this.prisma.tipo_afp.findUnique({ where: { id: dto.id_tipo_afp } }) : null,
      dto.id_banco_sueldo ? this.prisma.bancos.findUnique({ where: { id: dto.id_banco_sueldo } }) : null,
      dto.id_banco_cts ? this.prisma.bancos.findUnique({ where: { id: dto.id_banco_cts } }) : null,
    ]);

    // Validaciones de existencia de entidades foráneas
    if (!regimen) throw new NotFoundException('El régimen de pensión especificado no existe.');
    if (dto.id_tipo_afp && !tipoAfp) throw new NotFoundException('El tipo de AFP especificado no existe.');
    if (dto.id_banco_sueldo && !bancoSueldo) throw new NotFoundException('El banco para sueldo no existe.');
    if (dto.id_banco_cts && !bancoCts) throw new NotFoundException('El banco para CTS no existe.');

    // Validación específica para AFP: si el régimen es AFP, se requiere que se proporcionen administradora, CUSPP, comisión y fecha de afiliación.
    const esAfp = /AFP|SPP/i.test(regimen.nombre);
    if (esAfp && (!tipoAfp || !dto.cuspp || !dto.tipo_comision || !afiliacion))
      throw new BadRequestException('AFP requiere administradora, CUSPP, comisión y fecha de afiliación en el legajo.');

    if (tipoAfp && tipoAfp.id_regimen !== regimen.id)
      throw new BadRequestException('La AFP no corresponde al régimen pensionario.');
  }
}