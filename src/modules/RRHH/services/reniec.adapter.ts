//src/modules/RRHH/services/reniec.adapter.ts
//Adapter para interactuar con el servicio de RENIEC
//Permite obtener información de un ciudadano peruano a partir de su número de documento (DNI)
import { Injectable, Logger, RequestTimeoutException, BadGatewayException } from '@nestjs/common';

//Interfaz para representar la respuesta de RENIEC
export interface CiudadanoReniec {
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
}

@Injectable()
export class ReniecAdapter {
    private readonly logger = new Logger(ReniecAdapter.name); //Logger para registrar información y errores
    private readonly RENIEC_API_URL = process.env.RENIEC_API_URL || 'https://api.reniec.gob.pe'; //URL del servicio de RENIEC
    private readonly RENIEC_API_KEY = process.env.RENIEC_API_KEY;
 
    async consultarDni(dni: string): Promise<CiudadanoReniec> {
        try {
            //El controlador AbortController previene que Node.js se quede colgado si RENIEC no responde
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout estricto de 5s

            const res = await fetch(`${this.RENIEC_API_URL}${dni}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.RENIEC_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId); //Limpiar el timeout si la respuesta llega a tiempo

            if (!res.ok) throw new BadGatewayException(`La API de RENIEC respondió con status: ${res.status}`);

            const data = await res.json();
            
            return {
                nombre: data.nombres,
                apellido_paterno: data.apellidoPaterno,
                apellido_materno: data.apellidoMaterno
            };

        } catch (error: any) {
            this.logger.error(`Fallo al consultar DNI ${dni} en RENIEC: ${error.message}`);
            if (error.name === 'AbortError') throw new RequestTimeoutException('Timeout: La API de RENIEC tardó demasiado en responder.');
            throw new BadGatewayException('Servicio de RENIEC no disponible temporalmente.');
        }
    }
}