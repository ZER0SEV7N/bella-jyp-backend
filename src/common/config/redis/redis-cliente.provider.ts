import { Provider } from "@nestjs/common";
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const ResdisClientProvider: Provider = {
    provide: REDIS_CLIENT,
    useFactory: () => {
        return new Redis({
            host:process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
    });
 },
};