//src/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '../../services/reniec.adapter';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Caso de uso para procesar una fila individual de empleado durante la carga masiva.
 * Este caso de uso realiza un Upsert (Actualizar o Crear) de un empleado basado en el DNI.
 * La operación es atómica y está gobernada por la extensión de auditoría de Prisma.
 */
@Injectable()
export class ProcesarFilaEmpleadoUseCase {
  private readonly logger = new Logger(ProcesarFilaEmpleadoUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reniecAdapter: ReniecAdapter
  ) {}

  /**
   * Ejecuta el Upsert (Actualizar o Crear) de un empleado basado en el DNI.
   * Operación atómica gobernada por la extensión de auditoría de Prisma.
   */
  async execute(fila: CargaMasivaFilaDTO, jobId: string): Promise<void> {
    let nombreValidado = fila.nombre || null;
    let apellidoValidado = fila.apellido || null;
    let estadoSincronizacion: 'COMPLETO' | 'BORRADOR' = 'COMPLETO';

    //Validar el tipo de documento proporcionado en la fila
    const tipoDoc = await this.prisma.tipo_documento.findFirst({
      where: { tipo_documento: { equals: fila.tipo_documento, mode: 'insensitive' } } 
    });

    if (!tipoDoc)throw new Error(`El tipo de documento '${fila.tipo_documento}' no existe en la base de datos.`);

    //Buscar el área y cargo proporcionados en la fila, asegurando que existan y estén activos
    const area = await this.prisma.area.findFirst({
      where: { nombre: { equals: fila.area, mode: 'insensitive' }, deleted_at: null }
    });

    if (!area) throw new Error(`El área '${fila.area}' no existe o está desactivada.`);

    //buscar el cargo dentro del área especificada, asegurando que exista y esté activo
    const cargo = await this.prisma.cargo.findFirst({
      where: { nombre: { equals: fila.cargo, mode: 'insensitive' }, id_area: area.id, deleted_at: null }
    });

    if (!cargo) throw new Error(`El cargo '${fila.cargo}' no existe dentro del área '${fila.area}'.`);

    //Buscar la jornada proporcionada en la fila, asegurando que exista y esté activa
    let jornadaId = null;
    if (fila.jornada) {
      const jornada = await this.prisma.jornada.findFirst({where: { nombre: { equals: fila.jornada, mode: 'insensitive' }, deleted_at: null }});
      if (!jornada) throw new Error(`El turno/jornada '${fila.jornada}' no existe.`);
      jornadaId = jornada.id;
    }

    //Obtener el estado base de empleado (ACTIVO) para asignarlo al nuevo registro
    const estadoBase = await this.prisma.estado_empleado.findFirst({where: { descripcion: 'ACTIVO' }});

    if (!estadoBase) throw new Error('Catálogo de estado ACTIVO no configurado.');

    //Si el CSV no trae nombres, intentamos obtenerlos de RENIEC
    if (!nombreValidado || !apellidoValidado) {
      try {
        const ciudadano = await this.reniecAdapter.consultarDni(fila.nro_documento);

        nombreValidado = ciudadano.nombre;
        apellidoValidado = `${ciudadano.apellido_paterno} ${ciudadano.apellido_materno}`;
      } catch (error) {
        this.logger.warn(`Degradando legajo ${fila.nro_documento} a BORRADOR. RENIEC inaccesible.`, error);
        //El empleado se guarda, pero RRHH tendrá que revisarlo manualmente
        estadoSincronizacion = 'BORRADOR';
      }
    }

    //Si a pesar de RENIEC seguimos sin nombre, la fila es estructuralmente inválida
    if (!nombreValidado || !apellidoValidado)
      throw new Error(`Imposible registrar DNI ${fila.nro_documento}: Nombres ausentes y RENIEC inoperativo.`);

    //Obtenemos el estado base de empleado (ACTIVO) para asignarlo al nuevo registro

    if (!estadoBase)
      throw new Error('No existe el estado de empleado base en el catálogo.');

    //Persistencia Transaccional (Upsert para garantizar Idempotencia)
    await this.prisma.empleados.upsert({
      where: { nro_documento: fila.nro_documento },
      update: {
        area_id: area.id,
        cargo_id: cargo.id,
        jornada_id: jornadaId,
        fecha_nacimiento: fila.fecha_nacimiento ? new Date(fila.fecha_nacimiento) : undefined,
        asig_familiar: fila.asig_familiar,
        //Actualizamos estado de sincronización si se procesa nuevamente
        estado_sincronizacion: estadoSincronizacion
      },
      create: {
        id: IdentityGenerator.generateId(),
        documento_id: tipoDoc.id,
        nro_documento: fila.nro_documento,
        nombre: nombreValidado,
        apellido: apellidoValidado,
        area_id: area.id,
        cargo_id: cargo.id,
        jornada_id: jornadaId,
        fecha_nacimiento: fila.fecha_nacimiento ? new Date(fila.fecha_nacimiento) : undefined,
        asig_familiar: fila.asig_familiar,
        estado_empleado_id: estadoBase.id,
        estado_sincronizacion: estadoSincronizacion,
        activo: true
      }
    });
  }
}
