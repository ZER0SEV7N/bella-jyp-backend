//src/modules/RRHH/services/reniec.adapter.ts
//Adapter para interactuar con el servicio de RENIEC
//Permite obtener información de un ciudadano peruano a partir de su número de documento (DNI)
import {
  Injectable,
  Logger,
  RequestTimeoutException,
  BadGatewayException,
} from '@nestjs/common';

//Interfaz para representar la respuesta de RENIEC
export interface CiudadanoReniec {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
}

/**
 * ReniecAdapter es un servicio que actúa como adaptador para interactuar con la API de RENIEC.
 * Permite consultar información de un ciudadano peruano a partir de su número de documento (DNI).
 * Implementa un timeout estricto para evitar que la aplicación se quede colgada si RENIEC no responde.
 */
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

      const res = await fetch(`${this.RENIEC_API_URL}/dni/${dni}?token=${this.RENIEC_API_KEY}`, {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
        signal: controller.signal
      });

      clearTimeout(timeoutId); //Limpiar el timeout si la respuesta llega a tiempo

      //Si la respuesta de RENIEC no es exitosa, lanzar excepcion
      if (!res.ok)throw new BadGatewayException(`La API de RENIEC respondió con status: ${res.status}`);

      //Parsear la respuesta JSON de RENIEC
      const data = await res.json();

      //Retornar los nombres y apellidos en formato Title Case para consistencia
      return {
        nombre: toTitleCase(data.nombres || data.nombre || ''),
        apellido_paterno: toTitleCase(data.apellidoPaterno || data.apellido_paterno || ''),
        apellido_materno: toTitleCase(data.apellidoMaterno || data.apellido_materno || '')
      };
    } catch (error: any) {
      this.logger.error(`Fallo al consultar DNI ${dni} en RENIEC: ${error.message}`, error.stack);
      if (error.name === 'AbortError')
        throw new RequestTimeoutException('Timeout: La API de RENIEC tardó demasiado en responder.',);
      throw new BadGatewayException('Servicio de RENIEC no disponible temporalmente.');
    }
  }
}

/**
 * Funcion auxiliar para normalizar texto a formato de Title Case
 * EJ: "ADRIAN MATIAS" -> "Adrian Matias"
 */
function toTitleCase(texto: string): string {
  if(!texto) return '';
  return texto.toLowerCase().trim().split(/\s+/).map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1)).join(' ');
}