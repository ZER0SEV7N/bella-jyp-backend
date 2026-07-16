//src/common/prisma/prisma.service.ts
//Servicio de Prisma para interactuar con la base de datos
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// INYECCIÓN CRÍTICA: Forzamos la carga síncrona del .env en la memoria de V8 
// ANTES de que el contenedor IoC intente instanciar la clase.
dotenv.config();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        const connectionString = process.env.DATABASE_URL;

        // Defensa Perimetral (Fail-Fast)
        if (!connectionString) {
            throw new Error('CRITICAL: DATABASE_URL no está definida en el entorno. Verifica tu archivo .env');
        }

        // 1. Instanciamos el Pool nativo de conexiones de PostgreSQL
        const pool = new Pool({ connectionString });

        // 2. Acoplamos el Pool al Driver Adapter de Prisma
        const adapter = new PrismaPg(pool);

        // 3. Inicializamos el motor nativo con el adaptador inyectado
        super({
            adapter,
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('Conexión ACID establecida vía Driver Adapter nativo (pg).');
        } catch (error) {
            this.logger.error('Fallo crítico al inicializar la base de datos.', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Conexiones de base de datos drenadas de forma segura (Graceful Shutdown).');
    }
}