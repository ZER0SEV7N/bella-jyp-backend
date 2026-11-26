//src/modules/RRHH/services/reniec.adapter.ts
//Adapter para interactuar con el servicio de RENIEC
//Permite obtener información de un ciudadano peruano a partir de su número de documento (DNI)
import {
  Injectable,
  Logger,
  RequestTimeoutException,
  BadGatewayException,
  BadRequestException,
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
  private readonly RENIEC_API_URL = process.env.RENIEC_API_URL;
  private readonly RENIEC_API_KEY = process.env.RENIEC_API_KEY;

  /**
   * Consulta la información de un ciudadano peruano a partir de su DNI.
   * @param dni - Número de documento de identidad (DNI) del ciudadano.
   * @returns Un objeto con la información del ciudadano.
   */
  async consultarDni(dni: string): Promise<CiudadanoReniec> {
    //Obtener el dni limpiandolo de espacios en blanco
    const dniLimpio = dni?.trim() ?? '';

    // Validar que el DNI tenga exactamente 8 dígitos numéricos
    if (!/^\d{8}$/.test(dniLimpio)) {
      throw new BadRequestException(
        'El DNI debe contener exactamente 8 dígitos numéricos.'
      );
    }

    // Construir la URL de la API de RENIEC
    let baseEnd = this.RENIEC_API_URL.length;
    // Eliminar la barra final si existe
    while (baseEnd > 0 && this.RENIEC_API_URL[baseEnd - 1] === '/') baseEnd--;

    // Construir la URL base
    const base = this.RENIEC_API_URL.slice(0, baseEnd);
    const url = new URL(`${base}/dni/${encodeURIComponent(dniLimpio)}`);

    // Agregar el token de la API si está disponible
    if (this.RENIEC_API_KEY) {
      url.searchParams.set('token', this.RENIEC_API_KEY);
    }

    // Configurar el timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout estricto de 5s

    // Realizar la solicitud a la API de RENIEC
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      // Revisar la respuesta del
      if (!res.ok) {
        throw new BadGatewayException(
          `La API de RENIEC respondió con status: ${res.status}`
        );
      }

      const data = await res.json();

      return {
        nombre: toTitleCase(data.nombres || data.nombre || ''),
        apellido_paterno: toTitleCase(
          data.apellidoPaterno || data.apellido_paterno || ''
        ),
        apellido_materno: toTitleCase(
          data.apellidoMaterno || data.apellido_materno || ''
        ),
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof BadGatewayException
      )
        throw error;
      this.logger.error(
        `Fallo al consultar DNI ${dniLimpio} en RENIEC: ${error?.message}`,
        error?.stack
      );
      if (error?.name === 'AbortError') {
        throw new RequestTimeoutException(
          'Timeout: La API de RENIEC tardó demasiado en responder.'
        );
      }
      throw new BadGatewayException(
        'Servicio de RENIEC no disponible temporalmente.'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Funcion auxiliar para normalizar texto a formato de Title Case
 * EJ: "ADRIAN MATIAS" -> "Adrian Matias"
 */
function toTitleCase(texto: string): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}
