//src/common/prisma/prisma.service.ts
//Servicio de Prisma para interactuar con la base de datos
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        //Configurar Prisma para que escupa logs de consulta en desarrollo y pruebas, pero no en producción
        super({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }

    //Conectar y desconectar de la base de datos al iniciar y destruir el módulo
    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
