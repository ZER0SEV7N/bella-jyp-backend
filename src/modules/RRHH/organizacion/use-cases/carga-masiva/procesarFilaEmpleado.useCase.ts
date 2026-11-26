//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase.ts
import { Injectable, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CLS_USER_ID } from '@/common/cls/cls.constants';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { Prisma } from '@prisma/client';
import { normalizarFecha } from './helpers/normalizaciones.helper';
import { sincronizarJornadaInicialEmpleado } from '@/modules/RRHH/common/sincronizar-jornada-inicial.helper';
import type { ContextoCatalogosCargaMasiva } from './helpers/catalogos-carga-masiva.helper';

/**
 * Caso de uso para procesar una fila de datos de empleado en la carga masiva.
 * Recibe un `contexto` con los catálogos ya resueltos (área, cargo, jornada, régimen, AFP y bancos)
 * para no consultar la base de datos por cada fila (elimina el patrón N+1).
 */
@Injectable()
export class ProcesarFilaEmpleadoUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cls?: ClsService
  ) {}

  /**
   * Procesa una fila de la carga masiva: valida, resuelve catálogos desde el contexto y persiste
   * el empleado y sus datos financieros de manera atómica.
   * @param fila - Objeto con los datos de la fila a procesar.
   * @param jobId - ID del job de carga masiva.
   * @param contexto - Catálogos resueltos una sola vez por el worker.
   * @throws - Lanza errores si ocurre algún fallo durante el procesamiento, los cuales son manejados por el worker.
   */
  async execute(
    fila: CargaMasivaFilaDTO,
    jobId: string,
    contexto: ContextoCatalogosCargaMasiva
  ): Promise<void> {
    const nroDoc = fila.nro_documento.trim();
    //También protege los trabajos antiguos que quedaron en cola antes del contrato obligatorio.
    if (!fila.nombre?.trim() || !fila.apellido?.trim())
      throw new Error(
        `La fila del trabajo ${jobId} requiere nombre y apellido completos.`
      );
    const nombre = fila.nombre.trim();
    const apellido = fila.apellido.trim();
    const estadoSincronizacion = 'COMPLETO' as const;

    //Resolución de catálogos en memoria (sin consultas por fila).
    const tipoDoc = contexto.tipoDocumento.get(
      fila.tipo_documento.trim().toLowerCase()
    );
    if (!tipoDoc)
      throw new Error(
        `El tipo de documento '${fila.tipo_documento}' no existe en la base de datos.`
      );

    const area = contexto.area.get(fila.area.trim().toLowerCase());
    if (!area) throw new Error(`El área '${fila.area}' no se pudo resolver.`);

    const cargo = contexto.cargo.get(
      `${area.id}::${fila.cargo.trim().toLowerCase()}`
    );
    if (!cargo)
      throw new Error(`El cargo '${fila.cargo}' no se pudo resolver.`);

    const jornadaId = fila.jornada
      ? (contexto.jornada.get(fila.jornada.trim().toLowerCase())?.id ?? null)
      : null;

    //Normalizar las fechas previamente validadas por el contrato de carga.
    const fechaNacimiento = normalizarFecha(fila.fecha_nacimiento);
    const fechaInicio = normalizarFecha(fila.fecha_inicio);
    if (!fechaInicio || !fechaNacimiento)
      throw new Error('Las fechas de nacimiento e ingreso son obligatorias.');

    //Persistir los datos del empleado y su información financiera de manera atómica.
    await this.prisma.$transaction(async (tx) => {
      const empleado = await tx.empleados.upsert({
        where: { nro_documento: nroDoc },
        update: {
          nombre,
          apellido,
          email: fila.email.trim(),
          telefono: fila.telefono.trim(),
          sexo: fila.sexo,
          estado_civil: fila.estado_civil,
          fecha_nacimiento: fechaNacimiento,
          direccion: fila.direccion.trim(),
          referencia_direccion: fila.referencia_direccion.trim(),
          nacionalidad: fila.nacionalidad,
          afp_fecha_filiacion: normalizarFecha(fila.afp_fecha_filiacion),
          departamento: fila.departamento.trim(),
          provincia: fila.provincia.trim(),
          distrito: fila.distrito.trim(),
          ubigeo: fila.ubigeo.trim(),
          area_id: area.id,
          cargo_id: cargo.id,
          jornada_id: jornadaId,
          fecha_inicio: fechaInicio,
          asig_familiar: Boolean(fila.asig_familiar),
          estado_sincronizacion: estadoSincronizacion,
          activo: true,
        },
        create: {
          id: IdentityGenerator.generateId(),
          documento_id: tipoDoc.id,
          nro_documento: nroDoc,
          nombre,
          apellido,
          email: fila.email.trim(),
          telefono: fila.telefono.trim(),
          sexo: fila.sexo,
          estado_civil: fila.estado_civil,
          fecha_nacimiento: fechaNacimiento,
          direccion: fila.direccion.trim(),
          referencia_direccion: fila.referencia_direccion.trim(),
          nacionalidad: fila.nacionalidad,
          afp_fecha_filiacion: normalizarFecha(fila.afp_fecha_filiacion),
          departamento: fila.departamento.trim(),
          provincia: fila.provincia.trim(),
          distrito: fila.distrito.trim(),
          ubigeo: fila.ubigeo.trim(),
          area_id: area.id,
          cargo_id: cargo.id,
          estado_laboral: 'ACTIVO',
          jornada_id: jornadaId,
          fecha_inicio: fechaInicio,
          asig_familiar: Boolean(fila.asig_familiar),
          estado_sincronizacion: estadoSincronizacion,
          activo: true,
        },
      });

      //Sincronizar la jornada inicial del empleado de manera atómica dentro de la transacción.
      await sincronizarJornadaInicialEmpleado(tx, {
        empleadoId: empleado.id,
        jornadaId: empleado.jornada_id,
        fechaInicio,
        usuarioId: this.cls?.get<string>(CLS_USER_ID),
        motivo:
          'Asignación inicial automática vía carga masiva de colaboradores.',
      });

      //Persistir o actualizar los datos financieros del empleado de manera atómica.
      await this.upsertDatoFinanciero(tx, empleado.id, fila, contexto);
    });
  }

  /**
   * Inserta o actualiza los datos financieros del empleado usando los catálogos resueltos en el contexto.
   * @param tx - Transacción de Prisma.
   * @param empleadoId - ID del empleado.
   * @param fila - Fila de carga masiva con la información financiera.
   * @param contexto - Catálogos resueltos del job.
   */
  private async upsertDatoFinanciero(
    tx: Prisma.TransactionClient,
    empleadoId: string,
    fila: CargaMasivaFilaDTO,
    contexto: ContextoCatalogosCargaMasiva
  ): Promise<void> {
    //Resolver régimen de pensión desde el contexto (ONP o AFP/SPP).
    const regimen =
      fila.regimen_pension === 'AFP'
        ? contexto.regimenAfp
        : contexto.regimenOnp;
    if (!regimen)
      throw new Error(
        `El régimen '${fila.regimen_pension}' no existe en el catálogo.`
      );

    //Resolver el tipo de AFP solo si el régimen es AFP y se proporciona un tipo de AFP.
    let tipoAfpId: string | null = null;
    if (fila.regimen_pension === 'AFP' && fila.tipo_afp) {
      const afp = contexto.tipoAfp.get(fila.tipo_afp.trim().toLowerCase());
      if (!afp) throw new Error('La AFP indicada no existe.');
      tipoAfpId = afp.id;
    }

    //Resolver bancos de sueldo y CTS desde el contexto.
    const bancoSueldo = fila.banco_sueldo
      ? (contexto.banco.get(fila.banco_sueldo.trim().toLowerCase()) ?? null)
      : null;
    const bancoCts = fila.banco_cts
      ? (contexto.banco.get(fila.banco_cts.trim().toLowerCase()) ?? null)
      : null;

    if (fila.banco_sueldo && !bancoSueldo)
      throw new Error('El banco de sueldo indicado no existe.');
    if (fila.banco_cts && !bancoCts)
      throw new Error('El banco CTS indicado no existe.');

    //Encriptar datos sensibles antes de persistirlos en la base de datos.
    const nroCuentaSueldoEnc = CryptoUtil.encryptOptional(
      fila.nro_cuenta_sueldo
    );
    const cciSueldoEnc = CryptoUtil.encryptOptional(fila.cci_sueldo);
    const nroCuentaCtsEnc = CryptoUtil.encryptOptional(fila.nro_cuenta_cts);
    const cciCtsEnc = CryptoUtil.encryptOptional(fila.cci_cts);

    //Construir el payload de datos financieros a persistir.
    const dataPayload = {
      id_regimen: regimen.id,
      id_tipo_afp: tipoAfpId,
      sueldo_basico: fila.sueldo_basico,
      cuspp: CryptoUtil.encryptOptional(sanitizarTexto(fila.cuspp)),
      tipo_comision: sanitizarTexto(fila.tipo_comision),

      id_banco_sueldo: bancoSueldo?.id ?? null,
      tipo_cuenta_sueldo: fila.tipo_cuenta_sueldo,
      nro_cuenta_sueldo: nroCuentaSueldoEnc,
      cci_sueldo: cciSueldoEnc,

      id_banco_cts: bancoCts?.id ?? null,
      tipo_cuenta_cts: fila.tipo_cuenta_cts,
      nro_cuenta_cts: nroCuentaCtsEnc,
      cci_cts: cciCtsEnc,

      regimen_salud: fila.regimen_salud,
      eps_costo_adicional: fila.eps_costo_adicional,
    };

    //Persistir o actualizar los datos financieros del empleado de manera atómica usando upsert.
    await tx.dato_financiero.upsert({
      where: { empleado_id: empleadoId },
      update: dataPayload,
      create: {
        id: IdentityGenerator.generateId(),
        empleado_id: empleadoId,
        ...dataPayload,
      },
    });
  }
}
