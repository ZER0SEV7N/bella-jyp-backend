//src/common/prisma/prisma.service.ts
//Servicio de Prisma para interactuar con la base de datos
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { ClsService } from 'nestjs-cls';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '../cls/cls.constants';
import { IdentityGenerator } from '../utils/uuid.util';

dotenv.config();

//Servicio de Prisma
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  //Logger para registrar eventos y errores relacionados con la base de datos
  private readonly logger = new Logger(PrismaService.name);

  //Inyectar el servicio de ClsService para manejar el contexto de la solicitud
  constructor(private readonly cls: ClsService) {
    const connectionString = process.env.DATABASE_URL;

    //Defensa Perimetral (Fail-Fast)
    if (!connectionString)
      throw new Error(
        'CRITICAL: DATABASE_URL no está definida en el entorno. Verifica tu archivo .env',
      );

    //Instanciar el Pool nativo de conexiones de PostgreSQL
    const pool = new Pool({ connectionString });

    //Acoplar el Pool al Driver Adapter de Prisma
    const adapter = new PrismaPg(pool);

    //Inicializar el motor nativo con el adaptador inyectado
    super({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });

    //Middleware para inyectar información de auditoría en cada operación de Prisma
    const clsService = this.cls; //Referencia al servicio de ClsService para uso dentro del middleware
    const localLogger = this.logger; //Referencia al logger para uso dentro del middleware
    const originalPrisma = this; //Referencia al servicio de Prisma original

    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            //Omitir tablas de auditoría para evitar recursión infinita
            if (
              !model ||
              ['audit_log', 'carga_masiva_jobs', 'anotacion_tareas'].includes(
                model,
              )
            )
              return query(args);

            //Filtar solo operaciones DML (Create, Update, Delete) para inyectar auditoría
            const isDML = ['create', 'update', 'delete'].includes(operation);
            if (!isDML) return query(args);

            let valoresAntes = null; //Variable para almacenar los valores antes de la operación (para auditoría)

            //Capturar el estado Exacto antes de la operación para operaciones de Update y Delete
            if (operation === 'update' || operation === 'delete') {
              try {
                valoresAntes = await (originalPrisma as any)[model].findUnique({
                  where: (args as any).where,
                });
              } catch (error) {
                localLogger.warn(
                  `Auditoría: No se pudo obtener el estado previo de ${model}`,
                );
              }
            }

            //Ejecutar la consulta original de Prisma
            const resultado = await query(args);

            //Capturar el estado Exacto después de la operación para operaciones de Create y Update
            let valoresDespues = null;
            if (operation === 'create' || operation === 'update')
              valoresDespues = resultado;

            //Extraer información de auditoría del contexto de la solicitud usando ClsService
            const userId = clsService.get(CLS_USER_ID) || 'system';
            const ipAddress = clsService.get(CLS_IP_ADDRESS) || '127.0.0.1';

            //Registrar la operación en la tabla de auditoría
            try {
              await (originalPrisma as any).audit_log.create({
                data: {
                  id: IdentityGenerator.generateId(),
                  usuario_id: userId,
                  accion: operation.toUpperCase(),
                  tabla_afectada: model,
                  registro_id:
                    (resultado as any)?.id ||
                    (args as any).where?.id ||
                    IdentityGenerator.generateId(),
                  valores_antes: valoresAntes
                    ? JSON.stringify(valoresAntes)
                    : null,
                  valores_despues: valoresDespues
                    ? JSON.stringify(valoresDespues)
                    : null,
                  direccion_ip: ipAddress,
                },
              });
            } catch (error) {
              localLogger.error(
                `Auditoría: No se pudo registrar la operación de ${operation} en ${model}`,
                error,
              );
            }

            return resultado;
          },
        },
      },
    });

    //Inyectar los métodos de ciclo de vida de NestJS en el cliente extendido para que se ejecuten correctamente
    Object.assign(extendedClient, {
      onModuleInit: this.onModuleInit.bind(this),
      onModuleDestroy: this.onModuleDestroy.bind(this),
    });

    //Retornar el cliente extendido con auditoría y ciclo de vida integrado
    return extendedClient as any;
  }

  //Implementación del ciclo de vida de NestJS para inicializar la conexión a la base de datos
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log(
        'Conexión ACID establecida vía Driver Adapter nativo (pg).',
      );
    } catch (error) {
      this.logger.error(
        'Fallo crítico al inicializar la base de datos.',
        error,
      );
      throw error;
    }
  }

  //Cerrar la conexión de forma segura al destruir el módulo
  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log(
      'Conexiones de base de datos drenadas de forma segura (Graceful Shutdown).',
    );
  }
}
